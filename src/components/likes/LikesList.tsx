import React from 'react';
import { UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Heart, Compass, MapPin, ArrowLeft, ArrowRight, ShieldAlert, Star, Lock, Quote } from 'lucide-react';
import { LikeEntry } from '../../types';

interface LikesListProps {
  likes: LikeEntry[];
  /** Likes the server counted but did not identify (free plan). */
  hiddenCount?: number;
  onUpgrade?: () => void;
  isGuest?: boolean;
  onOpenAuth?: () => void;
  onLikeBack: (targetProfile: UserProfile) => void;
  onPass: (targetProfile: UserProfile) => void;
  onViewProfile: (profile: UserProfile) => void;
  onReport: (profile: UserProfile) => void;
  onGoToDiscover: () => void;
}

export const LikesList: React.FC<LikesListProps> = ({
  likes,
  hiddenCount = 0,
  onUpgrade,
  isGuest = false,
  onOpenAuth,
  onLikeBack,
  onPass,
  onViewProfile,
  onReport,
  onGoToDiscover,
}) => {
  if (isGuest) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-arrow-orange)] shadow-xs">
          <Heart size={28} strokeWidth={2} />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Incoming Arrows
          </h3>
          <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed">
            Log in or create your profile to receive Arrows and connect directly with people who like you.
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

  // The teaser is drawn from nothing but a number: the server sends no names,
  // photos or ids for hidden likes, so these tiles are generic placeholders,
  // not blurred versions of real people.
  const lockedCard =
    hiddenCount > 0 ? (
      <div className="relative overflow-hidden rounded-[28px] border-2 border-[var(--color-arrow-orange)] bg-[var(--color-surface)] p-5 shadow-xs">
        <div className="grid grid-cols-4 gap-2 mb-4" aria-hidden="true">
          {Array.from({ length: Math.min(hiddenCount, 4) }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-2xl blur-[2px]"
              style={{
                background: `linear-gradient(${140 + i * 30}deg, hsl(${(i * 47 + 12) % 360} 55% 62%), hsl(${(i * 47 + 52) % 360} 45% 38%))`,
              }}
            />
          ))}
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-[var(--color-arrow-orange-subtle)] text-[var(--color-arrow-orange-text)] flex items-center justify-center">
            <Lock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-[var(--color-ink)] tracking-tight">
              {hiddenCount} {hiddenCount === 1 ? 'person likes' : 'people like'} you
            </h3>
            <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed">
              Keep swiping and you may meet them in Discover — or see them all now with Plus.
            </p>
          </div>
        </div>
        {onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-4 w-full py-3 rounded-[var(--radius-pill)] bg-[var(--color-arrow-orange)] hover:bg-[var(--color-arrow-orange-hover)] text-white text-sm font-black active:scale-[0.98] transition-all"
          >
            See who likes you
          </button>
        )}
      </div>
    ) : null;

  if (likes.length === 0 && hiddenCount > 0) {
    return <div className="space-y-4 pb-24">{lockedCard}</div>;
  }

  if (likes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-arrow-orange)] shadow-xs">
          <Heart size={28} strokeWidth={2} />
        </div>
        <div className="space-y-1 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Nothing here yet.
          </h3>
          <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed">
            When someone likes your profile, they'll appear right here for you to like back.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={onGoToDiscover}
            icon={<Compass size={16} />}
            arrow="right"
          >
            Keep Exploring
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[var(--color-ink)] tracking-tight font-sans">
            Interested in You
          </h2>
          <p className="text-xs text-[var(--color-stone-dark)] font-medium">
            {likes.length + hiddenCount} {likes.length + hiddenCount === 1 ? 'person' : 'people'} sent you an arrow
          </p>
        </div>
      </div>

      {lockedCard}

      <div className="grid grid-cols-1 gap-4">
        {likes.map(({ profile, isSuper, note }) => {
          const photo = profile.photos[0];
          const monogramHue = profile.name
            .split('')
            .reduce((acc, ch) => (acc + ch.charCodeAt(0) * 17) % 360, 0);
          return (
            <div
              key={profile.id}
              className="bg-[var(--color-surface)] rounded-[28px] border border-[var(--color-border)] overflow-hidden shadow-xs flex flex-col transition-all hover:shadow-md"
            >
              {/* Photo & Profile Header */}
              <div
                onClick={() => onViewProfile(profile)}
                className="relative aspect-[16/10] bg-[var(--color-stone-light)] cursor-pointer group"
              >
                {photo ? (
                  <img
                    src={photo}
                    alt={profile.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background: `linear-gradient(145deg, hsl(${monogramHue} 40% 58%), hsl(${
                        (monogramHue + 40) % 360
                      } 36% 36%))`,
                    }}
                  >
                    <span className="text-6xl font-black text-white/25">
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {isSuper && (
                  <div className="absolute top-3.5 left-3.5 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-forest)] text-[var(--color-offwhite)] text-[10px] font-bold uppercase tracking-wider">
                    <Star size={11} />
                    <span>Super arrow</span>
                  </div>
                )}

                <div className="absolute top-3.5 right-3.5 z-10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReport(profile);
                    }}
                    className="p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition-colors backdrop-blur-xs cursor-pointer"
                    title="Safety & Report"
                    aria-label="Safety & Report"
                  >
                    <ShieldAlert size={14} />
                  </button>
                </div>

                <div className="absolute bottom-3.5 inset-x-5 text-white">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-xl font-black">{profile.name}</h3>
                    <span className="text-lg font-light text-white/90">
                      {profile.age}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white/80 font-medium">
                    <MapPin size={12} className="text-[var(--color-arrow-orange)]" />
                    <span>{profile.location}</span>
                  </div>
                </div>
              </div>

              {/* Bio & Details */}
              <div className="p-5 space-y-3.5">
                {note && (
                  <div className="flex gap-2 p-3 rounded-2xl bg-[var(--color-forest-subtle)] border border-[var(--color-border-subtle)]">
                    <Quote size={14} className="shrink-0 mt-0.5 text-[var(--color-forest)]" />
                    <p className="text-sm text-[var(--color-ink)] leading-snug">{note}</p>
                  </div>
                )}
                {profile.bio && (
                  <p className="text-xs text-[var(--color-ink-soft)] line-clamp-2 leading-relaxed font-normal">
                    {profile.bio}
                  </p>
                )}

                {profile.interests && profile.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.slice(0, 3).map((interest, i) => (
                      <Badge key={i} variant="stone" size="sm">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Actions: PASS and LIKE BACK */}
                <div className="pt-3 flex items-center gap-3 border-t border-[var(--color-stone-light)]">
                  <button
                    type="button"
                    onClick={() => onPass(profile)}
                    className="flex-1 py-3 px-4 rounded-2xl border border-[var(--color-border)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-stone-light)] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    <ArrowLeft size={14} />
                    <span>PASS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLikeBack(profile)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-[var(--color-arrow-orange)] text-white hover:bg-[var(--color-arrow-orange-hover)] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    <span>LIKE BACK</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

