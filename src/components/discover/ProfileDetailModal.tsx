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
    ? profile.photos
    : ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'];

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
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#EBE8E1] border border-[#E2DDD5]">
            <img
              src={photos[activePhotoIdx]}
              alt={profile.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Thumbnails if multiple */}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {photos.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === activePhotoIdx ? 'border-[#E85D2A] scale-105' : 'border-transparent opacity-70'
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
        <div className="border-b border-[#E2DDD5] pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#111111] tracking-tight">
              {profile.name}, <span className="font-normal text-[#7A766E]">{profile.age}</span>
            </h2>
            <button
              type="button"
              onClick={onReport}
              className="text-xs font-semibold text-[#D9383A] hover:underline flex items-center gap-1"
            >
              <ShieldAlert size={14} />
              <span>Report or Block</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#7A766E] font-medium mt-1">
            <MapPin size={14} className="text-[#E85D2A]" />
            <span>{profile.location}</span>
            <span className="mx-1">·</span>
            <span className="capitalize">{profile.gender}</span>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E]">
              About
            </h4>
            <p className="text-sm text-[#222222] leading-relaxed whitespace-pre-line">
              {profile.bio}
            </p>
          </div>
        )}

        {/* Looking For */}
        {profile.lookingFor && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E]">
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E]">
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E]">
              Prompts & Thoughts
            </h4>
            <div className="space-y-2.5">
              {profile.prompts.map(
                (p, idx) =>
                  p.answer && (
                    <div
                      key={idx}
                      className="p-4 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1.5"
                    >
                      <div className="text-xs font-bold text-[#17352F]">
                        <span>{p.question}</span>
                      </div>
                      <p className="text-sm text-[#111111] font-medium leading-relaxed">
                        {p.answer}
                      </p>
                    </div>
                  )
              )}
            </div>
          </div>
        )}

        {/* Bottom Actions Sticky in Modal */}
        <div className="pt-4 flex items-center gap-3 border-t border-[#E2DDD5]">
          <button
            type="button"
            onClick={() => {
              onPass();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-[#111111] text-[#111111] font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-[#111111] hover:text-[#F5F3EE] transition-colors"
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
            className="flex-1 py-3 px-4 rounded-xl bg-[#E85D2A] text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-[#D44F1F] shadow-sm transition-colors"
          >
            <span>LIKE</span>
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </Modal>
  );
};
