import React from 'react';
import { Avatar } from '../ui/Avatar';
import { SlidersHorizontal, Shield, User, Crown, Zap } from 'lucide-react';
import { PlanId, TabType, UserProfile } from '../../types';
import { Logo } from '../brand/Logo';

interface HeaderProps {
  currentTab: TabType;
  currentUser?: UserProfile | null;
  onOpenFilter?: () => void;
  hasActiveFilters?: boolean;
  onOpenSafety?: () => void;
  onOpenAuth?: () => void;
  plan?: PlanId;
  onOpenPlans?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentUser,
  onOpenFilter,
  hasActiveFilters = false,
  onOpenSafety,
  onOpenAuth,
  plan = 'free',
  onOpenPlans,
}) => {
  const tabTitles: Record<TabType, string> = {
    discover: 'Discover',
    likes: 'Likes & Arrows',
    matches: 'Chats',
    history: 'History',
    profile: 'Profile & Settings',
  };

  return (
    <header className="safe-top sticky top-0 z-30 bg-[var(--color-offwhite)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between px-4 md:px-8 py-3">
      <div className="flex items-center gap-3">
        {/* The rail carries the logo on large screens. */}
        <Logo size="sm" className="lg:hidden" />

        {currentTab !== 'discover' && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[var(--color-stone-dark)] uppercase tracking-wider pl-3 border-l border-[var(--color-border)]">
            {tabTitles[currentTab]}
          </div>
        )}
      </div>

      {/* Right Action Icons & Profile Login */}
      <div className="flex items-center gap-2 md:gap-3">
        {onOpenPlans && (
          !currentUser ? (
            <button
              type="button"
              onClick={onOpenPlans}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-xs font-black hover:border-[var(--color-ink)] transition-colors"
            >
              <Zap size={13} className="text-[var(--color-arrow-orange-text)]" />
              Plans
            </button>
          ) : plan === 'free' ? (
            <button
              type="button"
              onClick={onOpenPlans}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[var(--color-arrow-orange)] hover:bg-[var(--color-arrow-orange-hover)] text-white text-xs font-black active:scale-95 transition-all"
            >
              <Zap size={13} />
              Upgrade
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPlans}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                plan === 'premium'
                  ? 'bg-[var(--color-gold-subtle)] text-[var(--color-gold)]'
                  : 'bg-[var(--color-arrow-orange-subtle)] text-[var(--color-arrow-orange-text)]'
              }`}
              aria-label={`Your plan: ${plan}`}
            >
              <Crown size={12} />
              {plan}
            </button>
          )
        )}

        {currentTab === 'discover' && onOpenFilter && (
          <button
            type="button"
            onClick={onOpenFilter}
            className={`relative p-2.5 rounded-full border transition-all duration-150 flex items-center justify-center cursor-pointer ${
              hasActiveFilters
                ? 'bg-[var(--color-ink)] text-[var(--color-offwhite)] border-[var(--color-ink)] shadow-xs'
                : 'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)]'
            }`}
            aria-label="Discovery filters"
            title="Discovery Filters"
          >
            <SlidersHorizontal size={16} />
            {hasActiveFilters && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--color-arrow-orange)] ring-2 ring-[var(--color-offwhite)]" />
            )}
          </button>
        )}

        {onOpenSafety && (
          <button
            type="button"
            onClick={onOpenSafety}
            className="hidden sm:flex p-2.5 rounded-full bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
            title="Safety & Community Guidelines"
            aria-label="Safety center"
          >
            <Shield size={16} />
          </button>
        )}

        {/* Top Profile / Login Button */}
        {onOpenAuth && (
          currentUser ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 pl-1.5 pr-3 py-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-full transition-all duration-150 cursor-pointer shadow-2xs group"
              title={`Logged in as ${currentUser.name} - Click for Account Options`}
              aria-label="User Account"
            >
              <Avatar
                name={currentUser.name}
                src={currentUser.photos[0]}
                size="xs"
                rounded="full"
                className="w-7 h-7 text-[10px]"
              />
              <span className="text-xs font-bold text-[var(--color-ink)] max-w-[90px] truncate hidden sm:inline">
                {currentUser.name}
              </span>
              <span className="w-2 h-2 rounded-full bg-[var(--color-forest)] shrink-0" title="Active Account" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-ink)] hover:bg-black text-[var(--color-offwhite)] border border-[var(--color-ink)] transition-all duration-150 cursor-pointer shadow-xs font-sans text-xs font-bold"
              title="Log In or Create Profile"
              aria-label="Log In"
            >
              <User size={15} className="text-[var(--color-arrow-orange-text)]" />
              <span>Log In</span>
            </button>
          )
        )}
      </div>
      </div>
    </header>
  );
};


