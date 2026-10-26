// Called by a signed-in browser.
//
//   POST { action: 'checkout', plan: 'plus' | 'premium', method: 'card' | 'mpesa' } -> { url }
//   POST { action: 'manage' }  -> { url }   Paystack's page to change card or cancel
//   POST { action: 'cancel' }  -> { ok }    stop the card renewing; access runs to the end
//
// The user is identified from their own access token, never from the request
// body, and redirect targets come from APP_URL so this cannot be used as an
// open redirect.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import {
  corsHeaders,
  CURRENCY,
  json,
  Method,
  PaidPlan,
  paystack,
  PaystackSubscription,
  planCode,
  planForCode,
  priceKes,
} from '../_shared/paystack.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const appUrl = Deno.env.get('APP_URL');
  if (!appUrl || !Deno.env.get('PAYSTACK_SECRET_KEY')) {
    return json({ error: 'Payments are not set up yet.' }, 503);
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Please log in again.' }, 401);
  const user = auth.user;
  if (!user.email) return json({ error: 'Add an email address to your account to pay.' }, 400);

  let body: { action?: string; plan?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const { data: sub } = await admin
    .from('arrow_subscriptions')
    .select('plan, status, source, current_period_end, cancel_at_period_end, billing_subscription_id, billing_email_token')
    .eq('user_id', user.id)
    .maybeSingle();

  const running = Boolean(sub?.current_period_end && new Date(sub.current_period_end) > new Date());
  const renewingCard =
    sub?.source === 'card' && !sub.cancel_at_period_end && ['active', 'past_due'].includes(sub.status);

  try {
    if (body.action === 'manage' || body.action === 'cancel') {
      if (sub?.source !== 'card' || !sub.billing_subscription_id) {
        return json({ error: 'There is no card membership to manage.' }, 404);
      }

      if (body.action === 'manage') {
        const data = await paystack<{ link: string }>(`/subscription/${sub.billing_subscription_id}/manage/link`);
        return json({ url: data.link });
      }

      await paystack('/subscription/disable', {
        method: 'POST',
        body: JSON.stringify({ code: sub.billing_subscription_id, token: sub.billing_email_token }),
      });

      // Reflect it straight away rather than waiting for the webhook.
      const fresh = await paystack<PaystackSubscription>(`/subscription/${sub.billing_subscription_id}`);
      const plan = planForCode(fresh.plan?.plan_code) ?? (sub.plan as PaidPlan);
      await admin.rpc('arrow_apply_card_subscription', {
        p_user_id: user.id,
        p_plan: plan,
        p_status: fresh.status === 'active' ? 'non-renewing' : fresh.status,
        p_period_end: fresh.next_payment_date ?? sub.current_period_end,
        p_customer_code: fresh.customer?.customer_code ?? null,
        p_subscription_code: fresh.subscription_code,
        p_email_token: fresh.email_token,
      });
      return json({ ok: true });
    }

    if (body.action === 'checkout') {
      if (body.plan !== 'plus' && body.plan !== 'premium') return json({ error: 'Unknown plan' }, 400);
      if (body.method !== 'card' && body.method !== 'mpesa') return json({ error: 'Unknown payment method' }, 400);
      const plan = body.plan as PaidPlan;
      const method = body.method as Method;

      // One way of paying at a time, so nobody is charged twice for the same month.
      if (renewingCard) {
        return json(
          { error: 'You already have a card membership that renews. Manage it from Membership instead.' },
          409
        );
      }
      if (method === 'card' && sub?.source === 'mpesa' && running) {
        return json(
          {
            error: `Your M-Pesa pass runs until ${new Date(sub.current_period_end!).toLocaleDateString('en-KE')}. You can set up card renewal after it ends.`,
          },
          409
        );
      }

      const amount = priceKes(plan) * 100; // Paystack amounts are in cents
      const metadata = {
        arrow_user_id: user.id,
        arrow_plan: plan,
        arrow_method: method,
        // Where Paystack's own "Cancel payment" link sends people.
        cancel_action: `${appUrl}/?membership=cancelled`,
      };

      const data = await paystack<{ authorization_url: string }>('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: user.email,
          amount,
          currency: CURRENCY,
          // A plan code turns a card payment into a monthly subscription.
          // M-Pesa cannot be charged automatically, so it is a one-off.
          ...(method === 'card' ? { plan: planCode(plan), channels: ['card'] } : { channels: ['mobile_money'] }),
          callback_url: `${appUrl}/?membership=success`,
          metadata,
        }),
      });
      return json({ url: data.authorization_url });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[billing]', err);
    return json({ error: 'Could not reach the payment provider. Please try again.' }, 502);
  }
});
