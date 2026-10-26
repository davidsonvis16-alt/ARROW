import { PaymentMethod, PlanId } from '../types';

/**
 * What each membership is called, costs and includes, and how paying works —
 * everything the Membership screen tells people.
 *
 * This file only DESCRIBES the plans. What a plan actually unlocks is enforced
 * in supabase/schema.sql (arrow_plan_has / arrow_plan_limit), and what is
 * actually charged comes from the PRICE_PLUS_KES / PRICE_PREMIUM_KES secrets
 * and the Paystack plans (see SUPABASE_SETUP.md). Keep all three in step: the
 * price here must equal the price charged, and every row in FEATURE_TABLE must
 * match the schema, or the app promises something the server refuses.
 */

export const CURRENCY = 'KES';

/** Monthly price in whole shillings. Must equal PRICE_*_KES on the server. */
export const PRICE_KES: Record<PlanId, number> = {
  free: 0,
  plus: 499,
  premium: 999,
};

/** Days an M-Pesa payment buys. Must equal PASS_DAYS in the Edge Functions. */
export const PASS_DAYS = 30;
export const TRIAL_DAYS = 7;

export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

/** "about KES 17 a day" — the honest way to make a monthly price concrete. */
export function perDay(plan: PlanId): string {
  return `about ${formatKes(Math.round(PRICE_KES[plan] / 30))} a day`;
}

export interface PlanCopy {
  id: PlanId;
  name: string;
  tagline: string;
  highlights: string[];
}

export const PLANS: Record<PlanId, PlanCopy> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Everything you need to meet someone.',
    highlights: [
      'Create a profile with up to 6 photos',
      '50 arrows and 1 super arrow a day',
      '1 rewind a day',
      'Unlimited messaging with your matches',
      'See how many people liked you',
      'Every safety feature, always',
    ],
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    tagline: 'See who is into you, and never run out.',
    highlights: [
      'Everything in Free',
      'See everyone who liked you',
      'Unlimited arrows and rewinds',
      '3 super arrows a day, each with a note',
      'Filter by interests and intentions',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Be seen first, on your own terms.',
    highlights: [
      'Everything in Plus',
      '5 super arrows a day',
      'A 30-minute boost every week',
      'Incognito: only people you like can see you',
      'Read receipts in chat',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'plus', 'premium'];

/** Rows for the comparison table. `true` is a tick, a string is shown as-is. */
export const FEATURE_TABLE: Array<{ label: string; values: Record<PlanId, string | boolean> }> = [
  { label: 'Price per month', values: { free: 'KES 0', plus: formatKes(PRICE_KES.plus), premium: formatKes(PRICE_KES.premium) } },
  { label: 'Arrows per day', values: { free: '50', plus: 'Unlimited', premium: 'Unlimited' } },
  { label: 'Super arrows per day', values: { free: '1', plus: '3', premium: '5' } },
  { label: 'Note with a super arrow', values: { free: false, plus: true, premium: true } },
  { label: 'Rewinds', values: { free: '1 a day', plus: 'Unlimited', premium: 'Unlimited' } },
  { label: 'Messaging your matches', values: { free: true, plus: true, premium: true } },
  { label: 'Photos on your profile', values: { free: '6', plus: '6', premium: '6' } },
  { label: 'How many people liked you', values: { free: true, plus: true, premium: true } },
  { label: 'Who liked you', values: { free: 'Super only', plus: true, premium: true } },
  { label: 'Interest and intention filters', values: { free: false, plus: true, premium: true } },
  { label: 'Weekly 30-minute boost', values: { free: false, plus: false, premium: true } },
  { label: 'Incognito mode', values: { free: false, plus: false, premium: true } },
  { label: 'Read receipts', values: { free: false, plus: false, premium: true } },
  { label: 'Block, report, pause, safety tools', values: { free: true, plus: true, premium: true } },
];

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; short: string; detail: string[] }> = {
  mpesa: {
    label: 'M-Pesa',
    short: `${PASS_DAYS} days · no auto-renewal`,
    detail: [
      `Pay once for ${PASS_DAYS} days. Nothing is ever taken from your M-Pesa automatically.`,
      'You approve the payment with your M-Pesa PIN on your phone.',
      `Pay again any time to add another ${PASS_DAYS} days to the end of your pass.`,
    ],
  },
  card: {
    label: 'Card',
    short: 'Renews monthly · cancel any time',
    detail: [
      'Visa or Mastercard. Renews automatically every month until you cancel.',
      'Cancel in two taps from Membership — you keep your plan until the date you have paid up to.',
      'Your card details go to Paystack only. ARROW never sees your card number.',
    ],
  },
};

export const HOW_PAYING_WORKS = [
  'Choose a plan and how you want to pay.',
  'You go to Paystack\'s secure checkout page. Check the amount, then pay with M-Pesa or your card.',
  'You come straight back to ARROW and your plan switches on within a few seconds.',
  'Every payment appears under Payment history in Membership. Paystack also emails you a receipt.',
];

export const BILLING_FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Is Free really free?',
    a: 'Yes, for as long as you like. You can match and message without ever paying. Safety tools — blocking, reporting, pausing your profile — are free for everyone, on every plan.',
  },
  {
    q: 'How does the free trial work?',
    a: `Each account gets one ${TRIAL_DAYS}-day Plus trial. No card or M-Pesa is needed, nothing is charged, and it simply ends — it never turns into a paid plan by itself.`,
  },
  {
    q: 'How do I cancel?',
    a: 'Card plans: Settings → Membership → Cancel renewal. You keep your plan until the end of the month you paid for, and you are not charged again. M-Pesa passes never renew, so there is nothing to cancel.',
  },
  {
    q: 'What happens when my plan ends?',
    a: 'Your account goes back to Free. Your profile, photos, matches and chats all stay. Paid extras switch off: likes are hidden again (you still see how many), daily limits return, and incognito turns off so people can find you again.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Payments are not refunded for time already started, except where Kenyan consumer law gives you a right to one. If you were charged by mistake, contact us from the Terms page and we will look into it.',
  },
  {
    q: 'Can I switch between Plus and Premium?',
    a: 'With M-Pesa, buy the plan you want — a different plan starts straight away. With a card, cancel your renewal, then choose the new plan once your current month ends.',
  },
  {
    q: 'Does paying guarantee matches?',
    a: 'No. Paid plans help you see and be seen, but nobody can promise a match — be wary of any app that does.',
  },
  {
    q: 'Is my payment safe?',
    a: 'Payments are processed by Paystack, a payment provider owned by Stripe. ARROW never receives your card number or M-Pesa PIN.',
  },
];

/** Why the Membership screen opened, so it can lead with the relevant tier. */
export type UpgradeReason =
  | 'likes'
  | 'arrows'
  | 'rewind'
  | 'filters'
  | 'note'
  | 'boost'
  | 'incognito'
  | 'receipts'
  | 'browse';

export const UPGRADE_COPY: Record<UpgradeReason, { title: string; plan: Exclude<PlanId, 'free'> }> = {
  likes: { title: 'See everyone who liked you', plan: 'plus' },
  arrows: { title: "You're out of arrows for today", plan: 'plus' },
  rewind: { title: 'Rewind as often as you like', plan: 'plus' },
  filters: { title: 'Filter by what matters to you', plan: 'plus' },
  note: { title: 'Say something with your super arrow', plan: 'plus' },
  boost: { title: 'Be seen first with a boost', plan: 'premium' },
  incognito: { title: 'Browse on your own terms', plan: 'premium' },
  receipts: { title: 'Know when they have read it', plan: 'premium' },
  browse: { title: 'Plans & pricing', plan: 'plus' },
};
