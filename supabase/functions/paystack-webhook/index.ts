// Paystack -> ARROW. The only writer of paid plans.
//
// Deploy with --no-verify-jwt: Paystack does not send a Supabase login. What
// authenticates a request instead is Paystack's HMAC signature, checked before
// anything is read. Even then nothing in the payload is taken on trust: every
// charge is re-fetched from Paystack's API, and its amount and currency are
// checked against the configured price before any time is granted.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import {
  CURRENCY,
  PaidPlan,
  PASS_DAYS,
  paystack,
  PaystackSubscription,
  planForCode,
  priceKes,
  verifySignature,
} from '../_shared/paystack.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

interface Transaction {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  channel: string;
  metadata: Record<string, unknown> | string | null;
  plan: { plan_code?: string } | string | null;
  customer: { id: number; customer_code: string; email: string };
}

function meta(tx: Transaction): Record<string, unknown> {
  if (!tx.metadata) return {};
  if (typeof tx.metadata === 'string') {
    try {
      return JSON.parse(tx.metadata);
    } catch {
      return {};
    }
  }
  return tx.metadata;
}

async function userFor(customerCode: string | null, email: string | null, hinted?: unknown): Promise<string | null> {
  if (typeof hinted === 'string' && /^[0-9a-f-]{36}$/.test(hinted)) return hinted;
  const { data } = await admin.rpc('arrow_billing_user', { p_customer_code: customerCode, p_email: email });
  return (data as string | null) ?? null;
}

async function applySubscription(code: string): Promise<void> {
  const sub = await paystack<PaystackSubscription>(`/subscription/${code}`);
  const plan = planForCode(sub.plan?.plan_code);
  if (!plan) {
    console.warn('[paystack-webhook] subscription on an unknown plan', code);
    return;
  }
  const userId = await userFor(sub.customer?.customer_code ?? null, sub.customer?.email ?? null);
  if (!userId) {
    console.warn('[paystack-webhook] no ARROW account for subscription', code);
    return;
  }

  const { error } = await admin.rpc('arrow_apply_card_subscription', {
    p_user_id: userId,
    p_plan: plan,
    p_status: sub.status,
    p_period_end: sub.next_payment_date,
    p_customer_code: sub.customer?.customer_code ?? null,
    p_subscription_code: sub.subscription_code,
    p_email_token: sub.email_token,
  });
  if (error) throw new Error(error.message);
}

async function handleCharge(reference: string): Promise<void> {
  // Never trust the webhook body for money: ask Paystack directly.
  const tx = await paystack<Transaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status !== 'success') return;

  const m = meta(tx);
  const planCodeFromTx = typeof tx.plan === 'object' && tx.plan ? tx.plan.plan_code : typeof tx.plan === 'string' ? tx.plan : null;
  const plan: PaidPlan | null =
    m.arrow_plan === 'plus' || m.arrow_plan === 'premium' ? (m.arrow_plan as PaidPlan) : planForCode(planCodeFromTx);
  if (!plan) {
    console.warn('[paystack-webhook] charge for an unknown plan', reference);
    return;
  }

  const method = tx.channel === 'mobile_money' ? 'mpesa' : 'card';

  if (tx.currency !== CURRENCY || tx.amount < priceKes(plan) * 100) {
    console.error('[paystack-webhook] amount mismatch — not granting', reference, tx.amount, tx.currency);
    return;
  }

  const userId = await userFor(tx.customer?.customer_code ?? null, tx.customer?.email ?? null, m.arrow_user_id);
  if (!userId) {
    console.warn('[paystack-webhook] no ARROW account for charge', reference);
    return;
  }

  const { error } = await admin.rpc('arrow_record_payment', {
    p_reference: tx.reference,
    p_user_id: userId,
    p_plan: plan,
    p_method: method,
    p_amount_minor: tx.amount,
    p_currency: tx.currency,
    p_customer_code: tx.customer?.customer_code ?? null,
    p_pass_days: PASS_DAYS,
  });
  if (error) throw new Error(error.message);

  // A first card payment creates the subscription; sync it now so the plan
  // shows up without waiting for the separate subscription.create event.
  if (method === 'card' && tx.customer?.id) {
    const subs = await paystack<PaystackSubscription[]>(`/subscription?customer=${tx.customer.id}`);
    const current = subs
      .filter((s) => ['active', 'non-renewing', 'attention'].includes(s.status))
      .sort((a, b) => (b.next_payment_date ?? '').localeCompare(a.next_payment_date ?? ''))[0];
    if (current) await applySubscription(current.subscription_code);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get('x-paystack-signature')))) {
    return new Response('Bad signature', { status: 401 });
  }

  let event: { event: string; data: Record<string, any> };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Bad payload', { status: 400 });
  }

  try {
    switch (event.event) {
      case 'charge.success':
        await handleCharge(event.data.reference);
        break;

      case 'subscription.create':
      case 'subscription.not_renew':
      case 'subscription.disable':
      case 'subscription.expiring_cards':
        if (event.data.subscription_code) await applySubscription(event.data.subscription_code);
        break;

      case 'invoice.create':
      case 'invoice.update':
      case 'invoice.payment_failed':
        if (event.data.subscription?.subscription_code) {
          await applySubscription(event.data.subscription.subscription_code);
        }
        break;

      default:
        break;
    }
  } catch (err) {
    console.error('[paystack-webhook]', event.event, err);
    // A 500 makes Paystack retry later, which is what a transient failure needs.
    // Retries are safe: payments are recorded once per reference.
    return new Response('Handler error', { status: 500 });
  }

  return new Response('ok');
});
