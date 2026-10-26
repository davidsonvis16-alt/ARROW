// Shared by the billing and paystack-webhook functions.
//
// Every amount and plan code lives in Edge Function secrets, never in the
// browser. The client only ever names a plan and a payment method; what that
// costs and which Paystack plan it maps to is decided here.

export type PaidPlan = 'plus' | 'premium';
export type Method = 'card' | 'mpesa';

const API = 'https://api.paystack.co';
export const CURRENCY = 'KES';
/** An M-Pesa payment buys this many days. It never renews. */
export const PASS_DAYS = 30;

function secret(): string {
  const key = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return key;
}

/** Monthly price in whole shillings, from PRICE_PLUS_KES / PRICE_PREMIUM_KES. */
export function priceKes(plan: PaidPlan): number {
  const raw = Deno.env.get(plan === 'plus' ? 'PRICE_PLUS_KES' : 'PRICE_PREMIUM_KES');
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) throw new Error(`No price configured for ${plan}`);
  return value;
}

/** Paystack plan codes (PLN_…) for card subscriptions. */
export function planCode(plan: PaidPlan): string {
  const code = Deno.env.get(plan === 'plus' ? 'PAYSTACK_PLAN_PLUS' : 'PAYSTACK_PLAN_PREMIUM');
  if (!code) throw new Error(`No Paystack plan configured for ${plan}`);
  return code;
}

export function planForCode(code: string | undefined | null): PaidPlan | null {
  if (!code) return null;
  if (code === Deno.env.get('PAYSTACK_PLAN_PLUS')) return 'plus';
  if (code === Deno.env.get('PAYSTACK_PLAN_PREMIUM')) return 'premium';
  return null;
}

export async function paystack<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.status === false) {
    throw new Error(`Paystack ${path} failed: ${body?.message ?? res.status}`);
  }
  return body.data as T;
}

/** Paystack signs each webhook with HMAC-SHA512 of the raw body, keyed by the secret key. */
export async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export interface PaystackSubscription {
  subscription_code: string;
  email_token: string;
  status: string;
  next_payment_date: string | null;
  plan: { plan_code: string } | null;
  customer: { customer_code: string; email: string; id: number };
}

/** Only the app's own origin may call the billing function from a browser. */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}
