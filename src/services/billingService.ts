import { getSupabase } from '../lib/supabase';
import { rpc, rpcSafe } from './rpc';
import { PaymentMethod, PaymentRecord, PlanInfo } from '../types';

/**
 * Memberships.
 *
 * Nothing in here can change what you are entitled to on its own. Reading the
 * plan is an RPC; starting the one-time trial is an RPC the database limits to
 * once per account; paying happens on Paystack's checkout page, and only
 * Paystack's signed webhook can write the result back. A modified client can
 * call all of these and still not get Premium.
 */

export const FREE_PLAN: PlanInfo = {
  plan: 'free',
  status: 'inactive',
  source: 'none',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  paymentMethod: null,
  renews: false,
  canManageBilling: false,
  trialAvailable: false,
  trialDays: 7,
  features: {
    seeLikes: false,
    advancedFilters: false,
    arrowNotes: false,
    readReceipts: false,
    incognito: false,
    boost: false,
  },
  boostActiveUntil: null,
  boostsRemaining: 0,
};

async function invokeBilling<T extends { url?: string; ok?: boolean }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke<T & { error?: string }>('billing', { body });

  if (error || !data || data.error) {
    // The function returns a readable reason in its body even on 4xx; dig it
    // out so people see "your M-Pesa pass runs until…" rather than "error".
    let message = data?.error;
    const context = (error as { context?: Response } | null)?.context;
    if (!message && context && typeof context.json === 'function') {
      message = await context
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
    }
    if (!message && error && /not found|failed to send|relay/i.test(error.message)) {
      message = 'Payments are not set up yet. Please try again later.';
    }
    throw new Error(message || 'Could not reach the payment page. Please try again.');
  }

  return data;
}

export const billingService = {
  async getMyPlan(): Promise<PlanInfo> {
    return rpcSafe<PlanInfo>('arrow_get_my_plan', {}, FREE_PLAN);
  },

  async getPayments(): Promise<PaymentRecord[]> {
    return rpcSafe<PaymentRecord[]>('arrow_get_my_payments', {}, []);
  },

  async startTrial(): Promise<PlanInfo> {
    return rpc<PlanInfo>('arrow_start_trial');
  },

  async startBoost(): Promise<PlanInfo> {
    return rpc<PlanInfo>('arrow_start_boost');
  },

  /** Sends the browser to Paystack's checkout page. Returns only if that fails. */
  async startCheckout(plan: 'plus' | 'premium', method: PaymentMethod): Promise<void> {
    const { url } = await invokeBilling<{ url: string }>({ action: 'checkout', plan, method });
    window.location.assign(url);
  },

  /** Paystack's own page for updating the card on a subscription. */
  async openBillingPortal(): Promise<void> {
    const { url } = await invokeBilling<{ url: string }>({ action: 'manage' });
    window.location.assign(url);
  },

  /** Stop a card plan renewing. It keeps working until the paid period ends. */
  async cancelRenewal(): Promise<void> {
    await invokeBilling<{ ok: boolean }>({ action: 'cancel' });
  },
};
