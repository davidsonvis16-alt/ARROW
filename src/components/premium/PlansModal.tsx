import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { PaymentMethod, PaymentRecord, PlanId, PlanInfo } from '../../types';
import { api } from '../../services/api';
import { LegalDocType } from '../safety/LegalModal';
import {
  BILLING_FAQ,
  FEATURE_TABLE,
  formatKes,
  HOW_PAYING_WORKS,
  PASS_DAYS,
  PAYMENT_METHODS,
  perDay,
  PLAN_ORDER,
  PLANS,
  PRICE_KES,
  UPGRADE_COPY,
  UpgradeReason,
} from '../../config/plans';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  Minus,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: UpgradeReason;
  planInfo: PlanInfo;
  isGuest: boolean;
  onSignUp: () => void;
  onStartTrial: () => Promise<void>;
  onChoosePlan: (plan: 'plus' | 'premium', method: PaymentMethod) => Promise<void>;
  onManageBilling: () => Promise<void>;
  onCancelRenewal: () => Promise<void>;
  onOpenLegal: (type: LegalDocType) => void;
}

const ACCENT: Record<PlanId, { ring: string; chip: string; button: string; icon: React.ReactNode }> = {
  free: {
    ring: 'border-[var(--color-border)]',
    chip: 'bg-[var(--color-stone-light)] text-[var(--color-ink-soft)]',
    button: '',
    icon: null,
  },
  plus: {
    ring: 'border-[var(--color-arrow-orange)]',
    chip: 'bg-[var(--color-arrow-orange-subtle)] text-[var(--color-arrow-orange-text)]',
    button: 'bg-[var(--color-arrow-orange)] hover:bg-[var(--color-arrow-orange-hover)] text-white',
    icon: <Zap size={14} />,
  },
  premium: {
    ring: 'border-[var(--color-gold-fill)]',
    chip: 'bg-[var(--color-gold-subtle)] text-[var(--color-gold)]',
    button: 'bg-[var(--color-ink)] hover:bg-[var(--color-ink-soft)] text-[var(--color-offwhite)]',
    icon: <Crown size={14} />,
  },
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={15} className="mx-auto text-[var(--color-success)]" aria-label="Included" />;
  if (value === false) return <Minus size={15} className="mx-auto text-[var(--color-stone)]" aria-label="Not included" />;
  return <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--color-ink)] break-words">{value}</span>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--color-stone-dark)]">{children}</h4>;
}

/**
 * Membership: prices, what each plan includes, how and where to pay, your
 * current plan and receipts, and the answers people need before paying — all
 * on one screen, reachable from the header, the rail, the profile tab, every
 * paywall and the sign-in sheet.
 *
 * Buttons here only start things. Whether a plan is active is decided by the
 * server after Paystack confirms the payment, and this screen re-reads it.
 */
export const PlansModal: React.FC<PlansModalProps> = ({
  isOpen,
  onClose,
  reason,
  planInfo,
  isGuest,
  onSignUp,
  onStartTrial,
  onChoosePlan,
  onManageBilling,
  onCancelRenewal,
  onOpenLegal,
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const copy = UPGRADE_COPY[reason];
  const current = planInfo.plan;
  const renewingCard = planInfo.paymentMethod === 'card' && planInfo.renews;
  const mpesaRunning = planInfo.paymentMethod === 'mpesa' && current !== 'free';

  useEffect(() => {
    if (!isOpen) return;
    setConfirmCancel(false);
    if (!isGuest) api.getPayments().then(setPayments);
  }, [isOpen, isGuest, planInfo.currentPeriodEnd]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  /** What the button on a paid plan card does, given the current state. */
  const planAction = (id: Exclude<PlanId, 'free'>) => {
    if (isGuest) return { label: 'Create a free account first', disabled: false, onClick: onSignUp, note: null };
    if (renewingCard) {
      return id === current
        ? { label: 'Your plan', disabled: true, onClick: () => undefined, note: null }
        : { label: 'Cancel renewal to switch', disabled: true, onClick: () => undefined, note: null };
    }
    if (method === 'card' && mpesaRunning) {
      return {
        label: 'Available after your pass',
        disabled: true,
        onClick: () => undefined,
        note: `Your M-Pesa pass runs until ${fmtDate(planInfo.currentPeriodEnd)}. Card renewal can start after that.`,
      };
    }
    const price = formatKes(PRICE_KES[id]);
    const label =
      method === 'mpesa'
        ? mpesaRunning && id === current
          ? `Add ${PASS_DAYS} days · ${price}`
          : `Pay ${price} with M-Pesa`
        : `Subscribe · ${price}/month`;
    const note =
      method === 'mpesa' && mpesaRunning && id !== current
        ? `Starts ${PLANS[id].name} today and replaces the rest of your ${PLANS[current].name} pass.`
        : null;
    return { label, disabled: false, onClick: () => run(id, () => onChoosePlan(id, method)), note };
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="wide"
      title={current === 'free' ? copy.title : 'Your membership'}
      subtitle="Prices in Kenyan shillings · pay with M-Pesa or card"
    >
      <div className="space-y-6">
        {/* ------------------------------------------------ current status */}
        {!isGuest && current !== 'free' && (
          <div className="rounded-[var(--radius-card-sm)] border-2 border-[var(--color-success)] bg-[var(--color-surface)] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-success)]">Active</p>
                <p className="text-lg font-black tracking-tight text-[var(--color-ink)]">
                  ARROW {PLANS[current].name}
                  {planInfo.status === 'trialing' ? ' — free trial' : ''}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${ACCENT[current].chip}`}>
                {ACCENT[current].icon}
                {PLANS[current].name}
              </span>
            </div>

            <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
              {planInfo.status === 'trialing' &&
                `Your trial ends on ${fmtDate(planInfo.currentPeriodEnd)}. Nothing will be charged — you go back to Free unless you choose a plan.`}
              {planInfo.paymentMethod === 'mpesa' &&
                `Paid with M-Pesa until ${fmtDate(planInfo.currentPeriodEnd)}. It will not renew — pay again any time to add ${PASS_DAYS} more days.`}
              {renewingCard &&
                `Renews on ${fmtDate(planInfo.currentPeriodEnd)} — ${formatKes(PRICE_KES[current])} will be charged to your card.`}
              {planInfo.paymentMethod === 'card' &&
                !planInfo.renews &&
                planInfo.status !== 'past_due' &&
                `Renewal cancelled. You keep ${PLANS[current].name} until ${fmtDate(planInfo.currentPeriodEnd)} and will not be charged again.`}
              {planInfo.source === 'grant' && 'Given to you by the ARROW team.'}
            </p>

            {planInfo.status === 'past_due' && (
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-[var(--color-warning-subtle)] text-[var(--color-warning)] text-xs">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>
                  Your last card payment did not go through. Paystack will try again — update your card so you
                  keep {PLANS[current].name}.
                </span>
              </div>
            )}

            {planInfo.canManageBilling && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => run('manage', onManageBilling)}
                  disabled={busy !== null}
                  className="px-4 py-2 rounded-[var(--radius-pill)] border border-[var(--color-ink)] text-xs font-black text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-offwhite)] transition-colors disabled:opacity-60"
                >
                  {busy === 'manage' ? 'Opening…' : 'Update card'}
                </button>
                {planInfo.renews &&
                  (confirmCancel ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => run('cancel', onCancelRenewal)}
                        disabled={busy !== null}
                        className="px-4 py-2 rounded-[var(--radius-pill)] bg-[var(--color-danger)] text-white text-xs font-black disabled:opacity-60"
                      >
                        {busy === 'cancel' ? 'Cancelling…' : `Yes, stop renewing`}
                      </button>
                      <button type="button" onClick={() => setConfirmCancel(false)} className="text-xs font-bold text-[var(--color-stone-dark)]">
                        Keep it
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="px-4 py-2 rounded-[var(--radius-pill)] text-xs font-black text-[var(--color-danger-text)] hover:bg-[var(--color-danger-subtle)] transition-colors"
                    >
                      Cancel renewal
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------ trial / guest */}
        {isGuest ? (
          <div className="rounded-[var(--radius-card-sm)] p-4 bg-[var(--color-ink)] text-[var(--color-offwhite)] flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <p className="text-base font-black tracking-tight">Free to join. {planInfo.trialDays} days of Plus on us.</p>
              <p className="text-xs opacity-70">Create an account to start your free trial — no card or M-Pesa needed.</p>
            </div>
            <button
              type="button"
              onClick={onSignUp}
              className="shrink-0 px-5 py-3 rounded-[var(--radius-pill)] bg-[var(--color-arrow-orange)] text-white text-sm font-black hover:bg-[var(--color-arrow-orange-hover)]"
            >
              Create free account
            </button>
          </div>
        ) : (
          planInfo.trialAvailable && (
            <div className="relative overflow-hidden rounded-[var(--radius-card-sm)] p-4 sm:p-5 bg-[var(--color-ink)] text-[var(--color-offwhite)]">
              <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-[var(--color-arrow-orange)] opacity-30 blur-2xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-arrow-orange)]">Try it free</p>
                  <p className="text-base font-black tracking-tight">{planInfo.trialDays} days of Plus, on us</p>
                  <p className="text-xs opacity-70">No card or M-Pesa needed. One per account. It simply ends — nothing renews.</p>
                </div>
                <button
                  type="button"
                  onClick={() => run('trial', onStartTrial)}
                  disabled={busy !== null}
                  className="shrink-0 px-5 py-3 rounded-[var(--radius-pill)] bg-[var(--color-arrow-orange)] text-white text-sm font-black hover:bg-[var(--color-arrow-orange-hover)] active:scale-[0.98] transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {busy === 'trial' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  Start free trial
                </button>
              </div>
            </div>
          )
        )}

        {/* ------------------------------------------------- how you'll pay */}
        <section className="space-y-2.5">
          <SectionTitle>1 · Choose how to pay</SectionTitle>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
            {(['mpesa', 'card'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={`text-left p-3 rounded-2xl border-2 transition-colors ${
                  method === m
                    ? 'border-[var(--color-ink)] bg-[var(--color-surface)]'
                    : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-black text-[var(--color-ink)]">
                  {m === 'mpesa' ? <Smartphone size={16} className="text-[#2E9E3E]" /> : <CreditCard size={16} />}
                  {PAYMENT_METHODS[m].label}
                </span>
                <span className="block mt-0.5 text-[11px] text-[var(--color-stone-dark)]">{PAYMENT_METHODS[m].short}</span>
              </button>
            ))}
          </div>
          <ul className="space-y-1">
            {PAYMENT_METHODS[method].detail.map((line) => (
              <li key={line} className="flex items-start gap-1.5 text-xs text-[var(--color-ink-soft)]">
                <Check size={13} className="shrink-0 mt-0.5 text-[var(--color-success)]" />
                {line}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------ the plans */}
        <section className="space-y-3">
          <SectionTitle>2 · Choose a plan</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 pt-1">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const accent = ACCENT[id];
              const isCurrent = id === current && !isGuest;
              const isRecommended = id === copy.plan && current === 'free';
              const action = id === 'free' ? null : planAction(id);

              return (
                <div
                  key={id}
                  className={`relative flex flex-col rounded-[var(--radius-card-sm)] border-2 bg-[var(--color-surface)] p-4 ${
                    isRecommended || isCurrent ? accent.ring : 'border-[var(--color-border-subtle)]'
                  }`}
                >
                  {(isRecommended || isCurrent) && (
                    <span
                      className={`absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        isCurrent ? 'bg-[var(--color-success)] text-white' : accent.chip
                      }`}
                    >
                      {isCurrent ? 'Your plan' : 'Most popular'}
                    </span>
                  )}

                  <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${accent.chip}`}>
                    {accent.icon}
                    {plan.name}
                  </span>
                  <p className="mt-2 text-[11px] text-[var(--color-stone-dark)] leading-snug">{plan.tagline}</p>

                  <div className="mt-2">
                    <span className="text-2xl font-black tracking-tight text-[var(--color-ink)]">{formatKes(PRICE_KES[id])}</span>
                    <span className="text-[11px] text-[var(--color-stone-dark)]">
                      {id === 'free' ? ' forever' : method === 'mpesa' ? ` for ${PASS_DAYS} days` : ' a month'}
                    </span>
                    {id !== 'free' && <p className="text-[11px] text-[var(--color-stone-dark)]">{perDay(id)}</p>}
                  </div>

                  <ul className="mt-3 space-y-1.5 flex-1">
                    {plan.highlights.map((line) => (
                      <li key={line} className="flex items-start gap-1.5 text-xs text-[var(--color-ink-soft)]">
                        <Check size={13} className="shrink-0 mt-0.5 text-[var(--color-success)]" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 space-y-1.5">
                    {action === null ? (
                      <div className="py-2.5 text-center text-xs font-bold text-[var(--color-stone-dark)]">
                        {isCurrent ? 'What you have now' : 'Included with every account'}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={action.onClick}
                          disabled={busy !== null || action.disabled}
                          className={`w-full py-3 rounded-[var(--radius-pill)] text-xs font-black active:scale-[0.98] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${
                            action.disabled
                              ? 'bg-[var(--color-stone-light)] text-[var(--color-stone-dark)]'
                              : accent.button
                          }`}
                        >
                          {busy === id && <Loader2 size={13} className="animate-spin" />}
                          {action.label}
                        </button>
                        {action.note && <p className="text-[10px] text-[var(--color-stone-dark)] leading-snug">{action.note}</p>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------- how paying works */}
        <section className="rounded-[var(--radius-card-sm)] bg-[var(--color-surface)] border border-[var(--color-border-subtle)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--color-forest)]" />
            <h4 className="text-sm font-black text-[var(--color-ink)]">Where and how you pay</h4>
          </div>
          <ol className="space-y-2">
            {HOW_PAYING_WORKS.map((step, i) => (
              <li key={step} className="flex items-start gap-2.5 text-xs text-[var(--color-ink-soft)]">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-ink)] text-[var(--color-offwhite)] text-[10px] font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--color-stone-dark)]">
            <Lock size={12} /> Secured by Paystack. ARROW never sees your card number or M-Pesa PIN.
          </p>
        </section>

        {/* ---------------------------------------------- compare features */}
        <section className="space-y-2">
          <SectionTitle>Everything, side by side</SectionTitle>
          <div className="rounded-[var(--radius-card-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] overflow-x-auto">
            {/* Fixed layout so all three plans fit a phone screen without a
                hidden sideways scroll. */}
            <table className="w-full text-left table-fixed">
              <colgroup>
                <col className="w-[37%]" />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">Feature</th>
                  {PLAN_ORDER.map((id) => (
                    <th key={id} className="px-1 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-[var(--color-ink)]">
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_TABLE.map((row) => (
                  <tr key={row.label} className="border-t border-[var(--color-border-subtle)]">
                    <td className="px-3 py-2 text-[11px] sm:text-xs leading-snug text-[var(--color-ink-soft)]">{row.label}</td>
                    {PLAN_ORDER.map((id) => (
                      <td key={id} className="px-1 py-2 text-center leading-tight">
                        <Cell value={row.values[id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------------------------------ payment history */}
        {!isGuest && (
          <section className="space-y-2">
            <SectionTitle>Payment history</SectionTitle>
            {payments.length === 0 ? (
              <p className="text-xs text-[var(--color-stone-dark)]">No payments yet. Every payment you make will be listed here.</p>
            ) : (
              <ul className="rounded-[var(--radius-card-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] divide-y divide-[var(--color-border-subtle)]">
                {payments.map((p) => (
                  <li key={p.reference} className="flex items-start gap-3 px-3.5 py-3">
                    <Receipt size={16} className="shrink-0 mt-0.5 text-[var(--color-stone-dark)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--color-ink)]">
                        {PLANS[p.plan].name} · {p.method === 'mpesa' ? 'M-Pesa' : 'Card'}
                      </p>
                      <p className="text-[11px] text-[var(--color-stone-dark)]">
                        {fmtDate(p.paidAt)}
                        {p.coversUntil ? ` · covers until ${fmtDate(p.coversUntil)}` : ''}
                      </p>
                      <p className="text-[10px] text-[var(--color-stone-dark)] truncate">Ref {p.reference}</p>
                    </div>
                    <span className="text-xs font-black text-[var(--color-ink)] shrink-0">
                      {p.currency} {(p.amountMinor / 100).toLocaleString('en-KE')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ------------------------------------------------------------ FAQ */}
        <section className="space-y-2">
          <SectionTitle>Questions</SectionTitle>
          <div className="rounded-[var(--radius-card-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] divide-y divide-[var(--color-border-subtle)]">
            {BILLING_FAQ.map((item, i) => (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left text-xs font-bold text-[var(--color-ink)]"
                  aria-expanded={openFaq === i}
                >
                  {item.q}
                  <ChevronDown size={15} className={`shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <p className="px-3.5 pb-3 text-xs text-[var(--color-ink-soft)] leading-relaxed">{item.a}</p>}
              </div>
            ))}
          </div>
        </section>

        <p className="text-[10px] leading-relaxed text-[var(--color-stone-dark)]">
          Prices include any taxes we are required to charge and are shown again on the payment page before you
          pay. Card plans renew monthly until cancelled; M-Pesa passes never renew. By paying you agree to our{' '}
          <button type="button" onClick={() => onOpenLegal('terms')} className="underline font-semibold">
            Terms of Service
          </button>{' '}
          (section 7 covers memberships) and{' '}
          <button type="button" onClick={() => onOpenLegal('privacy')} className="underline font-semibold">
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </Modal>
  );
};
