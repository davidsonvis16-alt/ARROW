import React, { useMemo, useState } from 'react';
import { HistoryEntry, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { ArrowRight, Clock, Compass, MessageCircle, RotateCcw, Star, X } from 'lucide-react';

interface HistoryListProps {
  entries: HistoryEntry[];
  isGuest: boolean;
  onOpenAuth: () => void;
  onViewProfile: (profile: UserProfile) => void;
  /** Change your mind about someone you passed on. */
  onSendArrow: (profile: UserProfile) => void;
  onOpenChat: (profile: UserProfile) => void;
  onBringBackPasses: () => void;
  onUnsend: (profile: UserProfile) => void;
  onGoToDiscover: () => void;
}

type Filter = 'all' | 'arrows' | 'passed';

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Everyone you have swiped on, newest first. Swiping removes someone from the
 * deck, so this is where they stay findable — and where a pass you regret can
 * be turned into an arrow.
 */
export const HistoryList: React.FC<HistoryListProps> = ({
  entries,
  isGuest,
  onOpenAuth,
  onViewProfile,
  onSendArrow,
  onOpenChat,
  onBringBackPasses,
  onUnsend,
  onGoToDiscover,
}) => {
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(
    () =>
      entries.filter((e) =>
        filter === 'all' ? true : filter === 'passed' ? e.action === 'pass' : e.action !== 'pass'
      ),
    [entries, filter]
  );

  const passedCount = entries.filter((e) => e.action === 'pass').length;

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4 min-h-[60vh] px-6">
        <Clock size={32} className="text-[var(--color-arrow-orange-text)]" />
        <div className="space-y-1 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">Your history</h3>
          <p className="text-sm text-[var(--color-stone-dark)]">Log in to see everyone you have already swiped on.</p>
        </div>
        <Button variant="primary" onClick={onOpenAuth} arrow="right">
          Log in
        </Button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4 min-h-[60vh] px-6">
        <Clock size={32} className="text-[var(--color-arrow-orange-text)]" />
        <div className="space-y-1 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">Nothing here yet</h3>
          <p className="text-sm text-[var(--color-stone-dark)]">
            Everyone you pass on or send an arrow to will be listed here, so you never lose track of anyone.
          </p>
        </div>
        <Button variant="primary" onClick={onGoToDiscover} icon={<Compass size={16} />}>
          Start discovering
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black tracking-tight text-[var(--color-ink)]">History</h2>
        <p className="text-xs text-[var(--color-stone-dark)]">Everyone you have swiped on, newest first.</p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Filter history">
        {([
          ['all', `All · ${entries.length}`],
          ['arrows', `Arrows · ${entries.length - passedCount}`],
          ['passed', `Passed · ${passedCount}`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors ${
              filter === id
                ? 'bg-[var(--color-ink)] text-[var(--color-offwhite)]'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-ink)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filter === 'passed' && passedCount > 0 && (
        <button
          type="button"
          onClick={onBringBackPasses}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[var(--color-border)] text-xs font-bold text-[var(--color-ink)]"
        >
          <RotateCcw size={14} />
          Put everyone I passed on back in my deck
        </button>
      )}

      <ul className="space-y-2.5">
        {shown.map((entry) => {
          const { profile } = entry;
          return (
            <li
              key={profile.id}
              className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]"
            >
              <button
                type="button"
                onClick={() => onViewProfile(profile)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[var(--color-stone-light)] shrink-0 flex items-center justify-center">
                  {profile.photos[0] ? (
                    <img src={profile.photos[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xl font-black text-[var(--color-stone-dark)]">
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-ink)] truncate">
                    {profile.name}
                    {profile.age ? `, ${profile.age}` : ''}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-[var(--color-stone-dark)]">
                    {entry.isMatch ? (
                      <span className="font-bold text-[var(--color-success)]">Matched</span>
                    ) : entry.action === 'pass' ? (
                      <>
                        <X size={11} /> You passed
                      </>
                    ) : entry.action === 'super' ? (
                      <>
                        <Star size={11} className="text-[var(--color-forest)]" /> Super arrow sent
                      </>
                    ) : (
                      <>
                        <ArrowRight size={11} className="text-[var(--color-arrow-orange-text)]" /> Arrow sent
                      </>
                    )}
                    <span>· {ago(entry.at)}</span>
                  </p>
                </div>
              </button>

              {entry.isMatch ? (
                <button
                  type="button"
                  onClick={() => onOpenChat(profile)}
                  className="shrink-0 w-11 h-11 rounded-full bg-[var(--color-ink)] text-[var(--color-offwhite)] flex items-center justify-center"
                  aria-label={`Chat with ${profile.name}`}
                >
                  <MessageCircle size={17} />
                </button>
              ) : entry.action === 'pass' ? (
                <button
                  type="button"
                  onClick={() => onSendArrow(profile)}
                  className="shrink-0 px-3.5 h-11 rounded-full bg-[var(--color-arrow-orange)] text-white text-xs font-black"
                >
                  Send arrow
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Take back your arrow to ${profile.name}? They won't be told.`)) onUnsend(profile);
                  }}
                  className="shrink-0 px-3.5 h-11 rounded-full border border-[var(--color-border)] text-xs font-bold text-[var(--color-ink)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger-text)] transition-colors"
                >
                  Unsend
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
