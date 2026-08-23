import React from 'react';
import { UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Heart, Compass, MapPin, ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';

interface LikesListProps {
  likes: Array<{ profile: UserProfile }>;
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
        <div className="w-16 h-16 rounded-2xl bg-[#FAF8F4] border border-[#D9D6CF] flex items-center justify-center text-[#E85D2A] shadow-xs">
          <Heart size={28} strokeWidth={2} />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[#111111]">
            Incoming Arrows
          </h3>
          <p className="text-xs text-[#7A766E] leading-relaxed">
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

  if (likes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-[#FAF8F4] border border-[#D9D6CF] flex items-center justify-center text-[#E85D2A] shadow-xs">
          <Heart size={28} strokeWidth={2} />
        </div>
        <div className="space-y-1 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[#111111]">
            Nothing here yet.
          </h3>
          <p className="text-xs text-[#7A766E] leading-relaxed">
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
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#111111] tracking-tight font-sans">
            Interested in You
          </h2>
          <p className="text-xs text-[#7A766E] font-medium">
            {likes.length} {likes.length === 1 ? 'person' : 'people'} sent you an Arrow
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {likes.map(({ profile }) => {
          const photo = profile.photos[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
          return (
            <div
              key={profile.id}
              className="bg-[#FFFFFF] rounded-[28px] border border-[#D9D6CF] overflow-hidden shadow-xs flex flex-col transition-all hover:shadow-md"
            >
              {/* Photo & Profile Header */}
              <div
                onClick={() => onViewProfile(profile)}
                className="relative aspect-[16/10] bg-[#EBE8E1] cursor-pointer group"
              >
                <img
                  src={photo}
                  alt={profile.name}
                  className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

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
                    <MapPin size={12} className="text-[#E85D2A]" />
                    <span>{profile.location}</span>
                  </div>
                </div>
              </div>

              {/* Bio & Details */}
              <div className="p-5 space-y-3.5">
                {profile.bio && (
                  <p className="text-xs text-[#333333] line-clamp-2 leading-relaxed font-normal">
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
                <div className="pt-3 flex items-center gap-3 border-t border-[#EBE8E1]">
                  <button
                    type="button"
                    onClick={() => onPass(profile)}
                    className="flex-1 py-3 px-4 rounded-2xl border border-[#D9D6CF] bg-transparent text-[#111111] hover:bg-[#EBE8E1] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    <ArrowLeft size={14} />
                    <span>PASS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLikeBack(profile)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-[#E85D2A] text-white hover:bg-[#D05325] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer uppercase tracking-wider"
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

