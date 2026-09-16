import React from 'react';
import { Avatar } from '../ui/Avatar';
import { SlidersHorizontal, Shield, User, LogIn } from 'lucide-react';
import { TabType, UserProfile } from '../../types';

interface HeaderProps {
  currentTab: TabType;
  currentUser?: UserProfile | null;
  onOpenFilter?: () => void;
  hasActiveFilters?: boolean;
  onOpenSafety?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentUser,
  onOpenFilter,
  hasActiveFilters = false,
  onOpenSafety,
  onOpenAuth,
}) => {
  const tabTitles: Record<TabType, string> = {
    discover: 'Discover',
    likes: 'Likes & Arrows',
    matches: 'Mutual Matches',
    profile: 'Profile & Settings',
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-8 py-3.5 bg-[var(--color-offwhite)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
      {/* Brand Wordmark with Diamond Arrow Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-[var(--color-arrow-orange)] flex items-center justify-center transform rotate-45 rounded-[3px] shadow-xs">
            <div className="w-2 h-2 border-t-2 border-r-2 border-white transform -rotate-45 ml-[-1px] mt-[1px]" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase font-mono text-[var(--color-ink)]">
            ARROW
          </span>
        </div>

        {currentTab !== 'discover' && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[var(--color-stone-dark)] uppercase tracking-wider pl-3 border-l border-[var(--color-border)]">
            {tabTitles[currentTab]}
          </div>
        )}
      </div>

      {/* Right Action Icons & Profile Login */}
      <div className="flex items-center gap-2 md:gap-3">
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
            className="p-2.5 rounded-full bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
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
    </header>
  );
};


