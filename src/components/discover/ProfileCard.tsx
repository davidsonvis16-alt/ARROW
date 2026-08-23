import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { MapPin, ChevronLeft, ChevronRight, Info, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ProfileCardProps {
  profile: UserProfile;
  onLike: () => void;
  onPass: () => void;
  onOpenDetail: () => void;
  onReport: () => void;
  isAnimating?: 'like' | 'pass' | null;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onLike,
  onPass,
  onOpenDetail,
  onReport,
  isAnimating,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = profile.photos && profile.photos.length > 0
    ? profile.photos
    : ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'];

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  // Animation classes
  let cardTransformClass = 'transition-all duration-300 ease-out';
  if (isAnimating === 'like') {
    cardTransformClass = 'translate-x-36 -translate-y-8 rotate-6 opacity-0 transition-all duration-300 ease-in pointer-events-none';
  } else if (isAnimating === 'pass') {
    cardTransformClass = '-translate-x-36 translate-y-6 -rotate-6 opacity-0 transition-all duration-300 ease-in pointer-events-none';
  }

  return (
    <div
      className={`relative w-full max-w-md mx-auto aspect-[3/4] bg-[#D9D6CF] rounded-[32px] overflow-hidden shadow-2xl ring-1 ring-black/5 flex flex-col justify-end p-6 md:p-8 select-none group ${cardTransformClass}`}
    >
      {/* Background Photo */}
      <img
        src={photos[photoIndex]}
        alt={profile.name}
        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-102"
        referrerPolicy="no-referrer"
      />

      {/* Vignette Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/20 pointer-events-none" />

      {/* Story-style Photo Bars */}
      {photos.length > 1 && (
        <div className="absolute top-4 inset-x-5 flex gap-1.5 z-20">
          {photos.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                idx === photoIndex ? 'bg-white' : 'bg-white/35'
              }`}
            />
          ))}
        </div>
      )}

      {/* Top Action Buttons (Report & Info) */}
      <div className="absolute top-7 inset-x-5 flex items-center justify-between z-20 pointer-events-auto">
        <span className="text-[11px] font-bold tracking-widest uppercase px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-white/90 border border-white/10">
          {photoIndex + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail();
            }}
            className="p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 hover:text-white hover:bg-black/60 transition-all border border-white/10"
            title="Profile details"
            aria-label="Profile details"
          >
            <Info size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReport();
            }}
            className="p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 hover:text-white hover:bg-black/60 transition-all border border-white/10"
            title="Safety & Report"
            aria-label="Safety & Report"
          >
            <ShieldAlert size={16} />
          </button>
        </div>
      </div>

      {/* Photo Click Navigation Areas (Left / Right halves) */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={prevPhoto}
            className="absolute inset-y-16 left-0 w-1/3 z-10 opacity-0 group-hover:opacity-100 flex items-center justify-start pl-3 text-white/75 hover:text-white transition-opacity"
            aria-label="Previous photo"
          >
            <div className="p-2 rounded-full bg-black/30 backdrop-blur-sm border border-white/10">
              <ChevronLeft size={20} />
            </div>
          </button>
          <button
            type="button"
            onClick={nextPhoto}
            className="absolute inset-y-16 right-0 w-1/3 z-10 opacity-0 group-hover:opacity-100 flex items-center justify-end pr-3 text-white/75 hover:text-white transition-opacity"
            aria-label="Next photo"
          >
            <div className="p-2 rounded-full bg-black/30 backdrop-blur-sm border border-white/10">
              <ChevronRight size={20} />
            </div>
          </button>
        </>
      )}

      {/* Content Overlay */}
      <div className="relative z-20 text-white space-y-4">
        {/* Tags / Pills */}
        <div className="flex flex-wrap gap-2">
          {profile.lookingFor && (
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-white border border-white/20">
              {profile.lookingFor}
            </span>
          )}
          {profile.interests && profile.interests.slice(0, 2).map((tag, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-medium uppercase tracking-wider text-white/90 border border-white/10"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Name, Age, Location */}
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-md">
              {profile.name}, {profile.age}
            </h2>
            <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] shadow-[0_0_8px_#25D366]" title="Active recently" />
          </div>

          <div className="flex items-center gap-1.5 text-sm text-white/80 font-medium mt-1">
            <MapPin size={14} className="text-[#E85D2A]" />
            <span>{profile.location}</span>
            {profile.allowWhatsApp && (
              <span className="ml-2 px-2 py-0.5 rounded-md bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] text-[10px] font-bold">
                WhatsApp Enabled
              </span>
            )}
          </div>
        </div>

        {/* Bio snippet or Prompt snippet */}
        {profile.bio && (
          <p className="text-sm text-white/90 font-light leading-relaxed line-clamp-2 drop-shadow-sm">
            {profile.bio}
          </p>
        )}

        {/* Prompts preview if available */}
        {profile.prompts && profile.prompts.length > 0 && profile.prompts[0].answer && (
          <div className="p-3 bg-black/40 backdrop-blur-md rounded-2xl border border-white/15 text-xs text-white/90 space-y-1">
            <div className="text-[11px] font-bold text-[#E85D2A] uppercase tracking-wider">
              {profile.prompts[0].question}
            </div>
            <p className="italic text-white">"{profile.prompts[0].answer}"</p>
          </div>
        )}

        {/* Action Buttons: PASS & LIKE */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPass();
            }}
            className="flex-1 h-14 md:h-16 rounded-2xl bg-[#D9D6CF]/20 backdrop-blur-md border border-white/30 text-white font-bold text-base md:text-lg hover:bg-white/30 transition-all uppercase tracking-widest active:scale-[0.98] cursor-pointer flex items-center justify-center"
            aria-label="Pass profile"
          >
            PASS
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
            className="flex-1 h-14 md:h-16 rounded-2xl bg-[#E85D2A] text-white font-bold text-base md:text-lg hover:bg-[#D05325] transition-all shadow-lg uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
            aria-label="Like profile"
          >
            <span>LIKE</span>
            <span className="font-mono">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

