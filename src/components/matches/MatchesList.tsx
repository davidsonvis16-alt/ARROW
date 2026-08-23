import React from 'react';
import { UserProfile, MatchRecord } from '../../types';
import { Button } from '../ui/Button';
import { Users, Compass, MessageCircle, MapPin, ChevronRight } from 'lucide-react';

interface MatchesListProps {
  matches: Array<MatchRecord & { partnerProfile: UserProfile }>;
  isGuest?: boolean;
  onOpenAuth?: () => void;
  onSelectMatch: (match: MatchRecord & { partnerProfile: UserProfile }) => void;
  onGoToDiscover: () => void;
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
        <div className="w-16 h-16 rounded-2xl bg-[#FAF8F4] border border-[#D9D6CF] flex items-center justify-center text-[#111111] shadow-xs">
          <Users size={28} strokeWidth={2} />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[#111111]">
            Mutual Connections
          </h3>
          <p className="text-xs text-[#7A766E] leading-relaxed font-normal">
            When you and another member like each other, you match here and can exchange direct WhatsApp connections safely.
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
        <div className="w-16 h-16 rounded-2xl bg-[#FAF8F4] border border-[#D9D6CF] flex items-center justify-center text-[#111111] shadow-xs">
          <Users size={28} strokeWidth={2} />
        </div>
        <div className="space-y-1 max-w-xs">
          <h3 className="text-2xl font-black tracking-tight text-[#111111]">
            No matches yet.
          </h3>
          <p className="text-xs text-[#7A766E] leading-relaxed font-normal">
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
        <h2 className="text-xl font-black text-[#111111] tracking-tight font-sans">
          Your Connections
        </h2>
        <p className="text-xs text-[#7A766E] font-medium">
          {matches.length} mutual {matches.length === 1 ? 'match' : 'matches'}
        </p>
      </div>

      <div className="divide-y divide-[#D9D6CF] bg-[#FFFFFF] rounded-[28px] border border-[#D9D6CF] overflow-hidden shadow-xs">
        {matches.map((item) => {
          const profile = item.partnerProfile;
          const photo = profile.photos[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
          const matchDate = new Date(item.matchedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={item.id}
              onClick={() => onSelectMatch(item)}
              className="p-4 flex items-center gap-4 hover:bg-[#FAF8F4] transition-colors cursor-pointer group"
            >
              {/* Avatar */}
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-[#EBE8E1] border border-[#D9D6CF]">
                <img
                  src={photo}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <h3 className="text-base font-bold text-[#111111] truncate group-hover:text-[#E85D2A] transition-colors">
                    {profile.name}, <span className="font-normal text-[#7A766E]">{profile.age}</span>
                  </h3>
                  <span className="text-[10px] text-[#7A766E] shrink-0 font-medium">
                    {matchDate}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-[#7A766E] mt-0.5 truncate">
                  <MapPin size={12} className="text-[#E85D2A] shrink-0" />
                  <span className="truncate">{profile.location}</span>
                </div>

                {profile.allowWhatsApp && (
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#17352F] mt-1.5 bg-[#EAF1EF] border border-[#C5DCD6] px-2 py-0.5 rounded-full">
                    <MessageCircle size={10} className="text-[#25D366]" />
                    <span>WhatsApp Available</span>
                  </div>
                )}
              </div>

              {/* Chevron Arrow */}
              <div className="text-[#7A766E] group-hover:text-[#111111] group-hover:translate-x-0.5 transition-all">
                <ChevronRight size={18} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

