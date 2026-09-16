import React from 'react';
import { MatchWithProfile } from '../../types';
import { Button } from '../ui/Button';
import { Users, Compass, MessageCircle, MapPin, ChevronRight } from 'lucide-react';

interface MatchesListProps {
  matches: MatchWithProfile[];
  isGuest?: boolean;
  onOpenAuth?: () => void;
  onSelectMatch: (match: MatchWithProfile) => void;
  onGoToDiscover: () => void;
}

/** Short, relative timestamps read better than dates in a conversation list. */
function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 1440)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const MatchesList: React.FC<MatchesListProps> = ({
  matches,
  isGuest = false,
  onOpenAuth,
  onSelectMatch,
  onGoToDiscover,
}) => {
  if (isGuest) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink)] shadow-xs">
          <Users size={28} strokeWidth={2} />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Mutual Connections
          </h3>
          <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed font-normal">
            When you and another member like each other, you match here and can message each other here.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={onOpenAuth}
            arrow="right"
          >
            Log In or Create Profile
          </Button>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink)] shadow-xs">
          <Users size={28} strokeWidth={2} />
        </div>
        <div className="space-y-1 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            No matches yet.
          </h3>
          <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed font-normal">
            Your next connection could be one profile away. Discover people and like who catches your eye.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={onGoToDiscover}
            icon={<Compass size={16} />}
            arrow="right"
          >
            Discover People
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="space-y-0.5">
        <h2 className="text-xl font-black text-[var(--color-ink)] tracking-tight font-sans">
          Your Connections
        </h2>
        <p className="text-xs text-[var(--color-stone-dark)] font-medium">
          {matches.length} mutual {matches.length === 1 ? 'match' : 'matches'}
          {matches.some((m) => m.unreadCount > 0) && (
            <span className="text-[var(--color-arrow-orange)] font-bold">
              {' '}
              · {matches.filter((m) => m.unreadCount > 0).length} unread
            </span>
          )}
        </p>
      </div>

      <div className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)] rounded-[28px] border border-[var(--color-border)] overflow-hidden shadow-xs">
        {matches.map((item) => {
          const profile = item.partnerProfile;
          const photo = profile.photos[0];
          const stamp = item.lastMessage?.createdAt || item.matchedAt;
          const unread = item.unreadCount > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMatch(item)}
              className="w-full text-left p-4 flex items-center gap-4 hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer group"
            >
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-[var(--color-stone-light)] border border-[var(--color-border)] flex items-center justify-center">
                {photo ? (
                  <img src={photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-lg font-black text-[var(--color-stone-dark)]">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {unread && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-arrow-orange)] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[var(--color-surface)]">
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className={`text-base truncate transition-colors group-hover:text-[var(--color-arrow-orange)] ${
                      unread ? 'font-black text-[var(--color-ink)]' : 'font-bold text-[var(--color-ink)]'
                    }`}
                  >
                    {profile.name}
                    {profile.age ? (
                      <span className="font-normal text-[var(--color-stone-dark)]">, {profile.age}</span>
                    ) : null}
                  </h3>
                  <span className="text-[10px] text-[var(--color-stone-dark)] shrink-0 font-medium">
                    {relativeTime(stamp)}
                  </span>
                </div>

                {item.lastMessage ? (
                  <p
                    className={`text-xs mt-0.5 truncate ${
                      unread
                        ? 'text-[var(--color-ink)] font-semibold'
                        : 'text-[var(--color-stone-dark)]'
                    }`}
                  >
                    {item.lastMessage.isMine && <span className="text-[var(--color-stone-dark)]">You: </span>}
                    {item.lastMessage.body}
                  </p>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-[var(--color-stone-dark)] mt-0.5 truncate">
                    {profile.location ? (
                      <>
                        <MapPin size={12} className="text-[var(--color-arrow-orange)] shrink-0" />
                        <span className="truncate">{profile.location}</span>
                      </>
                    ) : (
                      <span className="italic">Say hello</span>
                    )}
                  </div>
                )}

                {profile.allowWhatsApp && !item.lastMessage && (
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-forest)] mt-1.5 bg-[var(--color-forest-subtle)] border border-[var(--color-border-subtle)] px-2 py-0.5 rounded-full">
                    <MessageCircle size={10} className="text-[#25D366]" />
                    <span>Open to WhatsApp</span>
                  </div>
                )}
              </div>

              <div className="text-[var(--color-stone-dark)] group-hover:text-[var(--color-ink)] group-hover:translate-x-0.5 transition-all">
                <ChevronRight size={18} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

