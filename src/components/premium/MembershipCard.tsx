import React from 'react';
import { PlanInfo } from '../../types';
import { formatKes, PLANS, PRICE_KES } from '../../config/plans';
import { ChevronRight, Crown, Zap } from 'lucide-react';

interface MembershipCardProps {
  planInfo: PlanInfo;
  isGuest: boolean;
  onOpen: () => void;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : '');

/**
 * The always-visible doorway to Membership on the profile tab: what you are
 * on, when it renews or ends, and what the next tier costs.
 */
export const MembershipCard: React.FC<MembershipCardProps> = ({ planInfo, isGuest, onOpen }) => {
  const plan = planInfo.plan;
  const isPaid = plan !== 'free' && !isGuest;

  const detail = isGuest
    ? `Free to join · Plus from ${formatKes(PRICE_KES.plus)}/month`
    : plan === 'free'
      ? planInfo.trialAvailable
        ? `Try Plus free for ${planInfo.trialDays} days · then from ${formatKes(PRICE_KES.plus)}/month`
        : `Plus ${formatKes(PRICE_KES.plus)} · Premium ${formatKes(PRICE_KES.premium)} a month`
      : planInfo.status === 'trialing'
        ? `Free trial ends ${fmt(planInfo.currentPeriodEnd)} · nothing will be charged`
        : planInfo.status === 'past_due'
          ? 'Card payment failed — tap to update your card'
          : planInfo.renews
            ? `Renews ${fmt(planInfo.currentPeriodEnd)} · ${formatKes(PRICE_KES[plan])} to your card`
            : `Active until ${fmt(planInfo.currentPeriodEnd)} · does not renew`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center gap-3 p-4 rounded-[var(--radius-card-sm)] text-left transition-all active:scale-[0.99] ${
        isPaid
          ? 'bg-[var(--color-surface)] border-2 border-[var(--color-gold-fill)]'
          : 'bg-gradient-to-br from-[var(--color-arrow-orange)] to-[#c43d1f] text-white'
      }`}
    >
      <span
        className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center ${
          isPaid ? 'bg-[var(--color-gold-subtle)] text-[var(--color-gold)]' : 'bg-white/20'
        }`}
      >
        {isPaid ? <Crown size={18} /> : <Zap size={18} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-black ${isPaid ? 'text-[var(--color-ink)]' : ''}`}>
          {isPaid ? `ARROW ${PLANS[plan].name}` : 'Membership & pricing'}
        </span>
        <span className={`block text-[11px] ${isPaid ? 'text-[var(--color-stone-dark)]' : 'opacity-90'}`}>{detail}</span>
      </span>
      <ChevronRight size={18} className={isPaid ? 'text-[var(--color-stone-dark)]' : ''} />
    </button>
  );
};
