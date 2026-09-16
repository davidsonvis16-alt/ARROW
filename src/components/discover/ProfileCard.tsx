import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../../types';
import {
  MapPin,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldAlert,
  RotateCcw,
  Star,
  X,
} from 'lucide-react';

interface ProfileCardProps {
  profile: UserProfile;
  onLike: () => void;
  onSuperLike?: () => void;
  onPass: () => void;
  onRewind?: () => void;
  onOpenDetail: () => void;
  onReport: () => void;
  isAnimating?: 'like' | 'pass' | 'super' | null;
  canRewind?: boolean;
  superRemaining?: number;
}

/** "Active today" is only shown when the person chose to share it. */
function activityLabel(lastActiveAt?: string | null): string | null {
  if (!lastActiveAt) return null;

  const minutes = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 60000);
  if (minutes < 0) return null;
  if (minutes < 15) return 'Active now';
  if (minutes < 60) return 'Active this hour';
  if (minutes < 60 * 24) return 'Active today';
  if (minutes < 60 * 24 * 7) return 'Active this week';
  return null;
}

/**
 * Someone with no photos gets a monogram on their own colour, derived from
 * their name. The previous placeholder was a stock photograph of an unrelated
 * person, which reads as a real picture of them — the one thing a placeholder
 * on a dating profile must never do.
 */
const Monogram: React.FC<{ name: string }> = ({ name }) => {
  const hue = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < name.length; i += 1) sum = (sum + name.charCodeAt(i) * 17) % 360;
    return sum;
  }, [name]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 42% 62%), hsl(${(hue + 40) % 360} 38% 38%))`,
      }}
      aria-hidden="true"
    >
      <span className="text-[7rem] font-black text-white/25 tracking-tighter select-none">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    </div>
  );
};

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onLike,
  onSuperLike,
  onPass,
  onRewind,
  onOpenDetail,
  onReport,
  isAnimating,
  canRewind = false,
  superRemaining = 0,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = profile.photos || [];
  const hasPhotos = photos.length > 0;
  const presence = activityLabel(profile.lastActiveAt);

  // A new person means a new photo strip.
  useEffect(() => setPhotoIndex(0), [profile.id]);

  const step = (delta: number) => {
    if (!hasPhotos) return;
    setPhotoIndex((prev) => (prev + delta + photos.length) % photos.length);
  };

  // Swiping with the keyboard is how anyone browsing on a laptop actually
  // wants to do this, and it is the accessible path through the deck.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          onPass();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onLike();
          break;
        case 'ArrowUp':
          if (onSuperLike && superRemaining > 0) {
            event.preventDefault();
            onSuperLike();
          }
          break;
        case 'i':
          onOpenDetail();
          break;
        case '[':
          step(-1);
          break;
        case ']':
          step(1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let motionClass = 'transition-all duration-300 ease-out';
  if (isAnimating === 'like') {
    motionClass =
      'translate-x-36 -translate-y-8 rotate-6 opacity-0 transition-all duration-300 ease-in pointer-events-none';
  } else if (isAnimating === 'pass') {
    motionClass =
      '-translate-x-36 translate-y-6 -rotate-6 opacity-0 transition-all duration-300 ease-in pointer-events-none';
  } else if (isAnimating === 'super') {
    motionClass =
      '-translate-y-40 scale-95 opacity-0 transition-all duration-300 ease-in pointer-events-none';
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      <div
        className={`relative w-full aspect-[3/4] bg-[var(--color-stone)] rounded-[var(--radius-card)] overflow-hidden shadow-2xl ring-1 ring-black/5 flex flex-col justify-end p-6 md:p-8 select-none group ${motionClass}`}
      >
        {hasPhotos ? (
          <img
            src={photos[photoIndex]}
            alt={`${profile.name}, photo ${photoIndex + 1} of ${photos.length}`}
            className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Monogram name={profile.name} />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/25 pointer-events-none" />

        {photos.length > 1 && (
          <div className="absolute top-4 inset-x-5 flex gap-1.5 z-20" aria-hidden="true">
            {photos.map((photo, idx) => (
              <div
                key={photo}
                className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                  idx === photoIndex ? 'bg-[var(--color-surface)]' : 'bg-white/35'
                }`}
              />
            ))}
          </div>
        )}

        <div className="absolute top-7 inset-x-5 flex items-center justify-between z-20">
          {presence ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase px-3 py-1 bg-black/45 backdrop-blur-md rounded-full text-white/90 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
              {presence}
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDetail}
              className="p-2.5 rounded-full bg-black/45 backdrop-blur-md text-white/90 hover:text-white hover:bg-black/65 transition-all border border-white/10"
              aria-label={`See ${profile.name}'s full profile`}
            >
              <Info size={16} />
            </button>
            <button
              type="button"
              onClick={onReport}
              className="p-2.5 rounded-full bg-black/45 backdrop-blur-md text-white/90 hover:text-white hover:bg-black/65 transition-all border border-white/10"
              aria-label={`Report or block ${profile.name}`}
            >
              <ShieldAlert size={16} />
            </button>
          </div>
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              className="absolute inset-y-16 left-0 w-1/3 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 flex items-center justify-start pl-3 text-white/75 hover:text-white transition-opacity"
              aria-label="Previous photo"
            >
              <span className="p-2 rounded-full bg-black/35 backdrop-blur-sm border border-white/10">
                <ChevronLeft size={20} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="absolute inset-y-16 right-0 w-1/3 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 flex items-center justify-end pr-3 text-white/75 hover:text-white transition-opacity"
              aria-label="Next photo"
            >
              <span className="p-2 rounded-full bg-black/35 backdrop-blur-sm border border-white/10">
                <ChevronRight size={20} />
              </span>
            </button>
          </>
        )}

        <div className="relative z-20 text-white space-y-4">
          <div className="flex flex-wrap gap-2">
            {profile.lookingFor && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-white border border-white/20">
                {profile.lookingFor}
              </span>
            )}
            {profile.interests?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-medium uppercase tracking-wider text-white/90 border border-white/10"
              >
                {tag}
              </span>
            ))}
          </div>

          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-md">
              {profile.name}
              {profile.age ? `, ${profile.age}` : ''}
            </h2>

            <div className="flex items-center gap-1.5 text-sm text-white/80 font-medium mt-1">
              {profile.location && (
                <>
                  <MapPin size={14} className="text-[var(--color-arrow-orange)]" />
                  <span>{profile.location}</span>
                </>
              )}
              {profile.allowWhatsApp && (
                <span className="ml-2 px-2 py-0.5 rounded-md bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] text-[10px] font-bold">
                  Open to WhatsApp
                </span>
              )}
            </div>
          </div>

          {profile.bio && (
            <p className="text-sm text-white/90 font-light leading-relaxed line-clamp-2 drop-shadow-sm">
              {profile.bio}
            </p>
          )}

          {profile.prompts?.[0]?.answer && (
            <div className="p-3 bg-black/45 backdrop-blur-md rounded-2xl border border-white/15 text-xs text-white/90 space-y-1">
              <div className="text-[11px] font-bold text-[var(--color-arrow-orange)] uppercase tracking-wider">
                {profile.prompts[0].question}
              </div>
              <p className="italic text-white">{profile.prompts[0].answer}</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls sit under the card so they never cover the photo, and so the
          rewind and super arrow have room to say what they cost. */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRewind}
          disabled={!canRewind}
          className="w-12 h-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-stone-dark)] flex items-center justify-center transition-all hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
          aria-label="Undo last swipe"
          title="Undo last swipe"
        >
          <RotateCcw size={18} />
        </button>

        <button
          type="button"
          onClick={onPass}
          className="flex-1 h-14 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-ink)] font-bold uppercase tracking-widest transition-all hover:border-[var(--color-ink)] active:scale-[0.98] flex items-center justify-center gap-2"
          aria-label={`Pass on ${profile.name}`}
        >
          <X size={18} />
          <span>Pass</span>
        </button>

        <button
          type="button"
          onClick={onSuperLike}
          disabled={!onSuperLike || superRemaining <= 0}
          className="w-12 h-12 rounded-full bg-[var(--color-forest)] text-white flex items-center justify-center transition-all hover:brightness-125 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 relative"
          aria-label={`Send a super arrow to ${profile.name}, ${superRemaining} left today`}
          title={superRemaining > 0 ? `Super arrow — ${superRemaining} left today` : 'No super arrows left today'}
        >
          <Star size={18} />
        </button>

        <button
          type="button"
          onClick={onLike}
          className="flex-1 h-14 rounded-2xl bg-[var(--color-arrow-orange)] text-white font-bold uppercase tracking-widest transition-all hover:bg-[var(--color-arrow-orange-hover)] shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
          aria-label={`Send an arrow to ${profile.name}`}
        >
          <span>Arrow</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <p className="text-center text-[11px] text-[var(--color-stone-dark)]">
        Use <kbd className="arrow-kbd">←</kbd> pass, <kbd className="arrow-kbd">→</kbd> arrow,{' '}
        <kbd className="arrow-kbd">↑</kbd> super, <kbd className="arrow-kbd">i</kbd> details
      </p>
    </div>
  );
};
