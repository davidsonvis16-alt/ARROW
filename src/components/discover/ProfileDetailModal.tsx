import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { MapPin, ShieldAlert, ArrowLeft, ArrowRight } from 'lucide-react';

interface ProfileDetailModalProps {
  profile: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onLike: () => void;
  onPass: () => void;
  onReport: () => void;
}

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  profile,
  isOpen,
  onClose,
  onLike,
  onPass,
  onReport,
}) => {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  if (!profile) return null;

  const photos = profile.photos && profile.photos.length > 0
    ? profile.photos : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title="Profile Details"
    >
      <div className="space-y-6 pb-4">
        {/* Photo Gallery Viewer */}
        <div className="space-y-2">
          {photos.length > 0 ? (
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[var(--color-stone-light)] border border-[var(--color-border-subtle)]">
              <img
                src={photos[activePhotoIdx]}
                alt={`${profile.name}, photo ${activePhotoIdx + 1}`}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="aspect-[16/9] rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] flex items-center justify-center text-xs text-[var(--color-stone-dark)]">
              {profile.name} has not added photos yet
            </div>
          )}

          {/* Thumbnails if multiple */}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {photos.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === activePhotoIdx ? 'border-[var(--color-arrow-orange)] scale-105' : 'border-transparent opacity-70'
                  }`}
                >
                  <img
                    src={url}
                    alt={`${profile.name} ${idx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Identity & Basic Info */}
        <div className="border-b border-[var(--color-border-subtle)] pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight">
              {profile.name}, <span className="font-normal text-[var(--color-stone-dark)]">{profile.age}</span>
            </h2>
            <button
              type="button"
              onClick={onReport}
              className="text-xs font-semibold text-[var(--color-danger-text)] hover:underline flex items-center gap-1"
            >
              <ShieldAlert size={14} />
              <span>Report or Block</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--color-stone-dark)] font-medium mt-1">
            <MapPin size={14} className="text-[var(--color-arrow-orange-text)]" />
            <span>{profile.location}</span>
            <span className="mx-1">·</span>
            <span className="capitalize">{profile.gender}</span>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">
              About
            </h4>
            <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-line">
              {profile.bio}
            </p>
          </div>
        )}

        {/* Looking For */}
        {profile.lookingFor && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">
              Looking For
            </h4>
            <Badge variant="accent" size="md">
              {profile.lookingFor}
            </Badge>
          </div>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">
              Interests & Passions
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((interest, i) => (
                <Badge key={i} variant="neutral" size="md">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Prompts */}
        {profile.prompts && profile.prompts.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">
              Prompts & Thoughts
            </h4>
            <div className="space-y-2.5">
              {profile.prompts.map(
                (p, idx) =>
                  p.answer && (
                    <div
                      key={idx}
                      className="p-4 bg-[var(--color-surface-subtle)] rounded-2xl border border-[var(--color-border-subtle)] space-y-1.5"
                    >
                      <div className="text-xs font-bold text-[var(--color-forest)]">
                        <span>{p.question}</span>
                      </div>
                      <p className="text-sm text-[var(--color-ink)] font-medium leading-relaxed">
                        {p.answer}
                      </p>
                    </div>
                  )
              )}
            </div>
          </div>
        )}

        {/* Bottom Actions Sticky in Modal */}
        <div className="pt-4 flex items-center gap-3 border-t border-[var(--color-border-subtle)]">
          <button
            type="button"
            onClick={() => {
              onPass();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-[var(--color-ink)] text-[var(--color-ink)] font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-[var(--color-ink)] hover:text-[var(--color-offwhite)] transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            <span>PASS</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onLike();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-[var(--color-arrow-orange)] text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-[var(--color-arrow-orange-hover)] shadow-sm transition-colors"
          >
            <span>LIKE</span>
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </Modal>
  );
};
