import React from 'react';
import { Clock, Compass, Heart, MessageCircle, User } from 'lucide-react';
import { TabType } from '../../types';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  likesCount: number;
  /** Unread messages across all matches — what actually needs attention. */
  unreadCount: number;
}

const TABS: Array<{ id: TabType; label: string; Icon: typeof Compass }> = [
  { id: 'discover', label: 'Discover', Icon: Compass },
  { id: 'likes', label: 'Likes', Icon: Heart },
  { id: 'matches', label: 'Chats', Icon: MessageCircle },
  { id: 'history', label: 'History', Icon: Clock },
  { id: 'profile', label: 'Profile', Icon: User },
];

/**
 * The phone tab bar. Fixed to the bottom of the visible screen (not the end of
 * a box), so a browser toolbar can never push it out of sight. Each tab is a
 * full-height, full-width touch target, and the current one is unmistakable.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, likesCount, unreadCount }) => {
  const badges: Partial<Record<TabType, number>> = { likes: likesCount, matches: unreadCount };

  return (
    <nav
      className="safe-bottom lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]"
      aria-label="Main Navigation"
    >
      <div className="flex items-stretch max-w-xl mx-auto">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = currentTab === id;
          const badge = badges[id] ?? 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 active:scale-95 transition-transform"
            >
              <span
                className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-colors ${
                  isActive ? 'bg-[var(--color-arrow-orange-subtle)] text-[var(--color-arrow-orange-text)]' : 'text-[var(--color-stone-dark)]'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {badge > 0 && (
                  <span className="absolute -top-1 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-arrow-orange)] text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-[var(--color-surface)]">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[11px] leading-none truncate ${
                  isActive ? 'font-black text-[var(--color-ink)]' : 'font-semibold text-[var(--color-stone-dark)]'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
