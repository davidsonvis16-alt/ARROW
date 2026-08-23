import React from 'react';
import { UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Camera,
  Edit3,
  Sliders,
  MessageCircle,
  Settings,
  MapPin,
  ShieldCheck,
  User,
  UserPlus,
  LogIn,
} from 'lucide-react';

interface ProfileViewProps {
  currentUser?: UserProfile | null;
  onEditProfile: () => void;
  onEditPhotos: () => void;
  onEditPreferences: () => void;
  onEditWhatsApp: () => void;
  onOpenSettings: () => void;
  onOpenAuth?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onEditProfile,
  onEditPhotos,
  onEditPreferences,
  onEditWhatsApp,
  onOpenSettings,
  onOpenAuth,
}) => {
  if (!currentUser) {
    return (
      <div className="space-y-6 pb-24">
        {/* Header & Settings Trigger */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xl font-black text-[#111111] tracking-tight font-sans">
              Your Profile
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#7A766E] font-medium">
              <span>Guest Mode · Not logged in</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="p-3 rounded-2xl border border-[#D9D6CF] bg-[#FAF8F4] text-[#111111] hover:bg-[#EBE8E1] transition-colors cursor-pointer"
            title="Account Settings & Safety"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Guest Intro Card */}
        <div className="bg-[#FFFFFF] rounded-[28px] border border-[#D9D6CF] p-6 shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[#FAF8F4] border border-[#D9D6CF] flex items-center justify-center text-[#E85D2A] mx-auto shadow-2xs">
            <User size={26} />
          </div>

          <div className="text-center space-y-1.5">
            <h3 className="text-xl font-black text-[#111111] tracking-tight">
              Create Your Identity
            </h3>
            <p className="text-xs text-[#7A766E] leading-relaxed max-w-sm mx-auto">
              Set up your photos, bio, 18+ verification, and optional direct WhatsApp connection to start meeting people.
            </p>
          </div>

          <div className="pt-2 space-y-2.5">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              icon={<UserPlus size={16} />}
              onClick={onOpenAuth}
              arrow="right"
            >
              Log In or Create Profile
            </Button>
          </div>
        </div>

        {/* Features Overview */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E] px-1">
            ARROW Account Features
          </h4>

          <div className="p-4 bg-white rounded-2xl border border-[#D9D6CF] flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#EAF1EF] border border-[#C5DCD6] text-[#17352F]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#111111]">18+ Human Verification</p>
              <p className="text-[11px] text-[#7A766E]">
                Genuine adult community with verified age standards.
              </p>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#D9D6CF] flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#FAF8F4] border border-[#D9D6CF] text-[#25D366]">
              <MessageCircle size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#111111]">Permission-Based WhatsApp</p>
              <p className="text-[11px] text-[#7A766E]">
                Direct number sharing unlocked only upon mutual match.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const photos = currentUser.photos && currentUser.photos.length > 0
    ? currentUser.photos
    : ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'];

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Settings Trigger */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-xl font-black text-[#111111] tracking-tight font-sans">
            Your Profile
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-[#17352F] font-bold">
            <ShieldCheck size={14} className="text-[#17352F]" />
            <span>18+ Verified Human Account</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-3 rounded-2xl border border-[#D9D6CF] bg-[#FAF8F4] text-[#111111] hover:bg-[#EBE8E1] transition-colors cursor-pointer"
          title="Account Settings"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Main Profile Card Preview */}
      <div className="bg-[#FFFFFF] rounded-[28px] border border-[#D9D6CF] overflow-hidden shadow-xs">
        {/* Photo Gallery Banner */}
        <div className="relative aspect-[4/3] bg-[#EBE8E1]">
          <img
            src={photos[0]}
            alt={currentUser.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Quick Photo Count Badge */}
          <button
            type="button"
            onClick={onEditPhotos}
            className="absolute top-3.5 right-3.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5 hover:bg-black/80 transition-colors cursor-pointer"
          >
            <Camera size={13} />
            <span>{photos.length} Photos</span>
          </button>

          {/* Identity */}
          <div className="absolute bottom-3.5 inset-x-5 text-white">
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black tracking-tight">{currentUser.name}</h3>
              <span className="text-xl font-light text-white/90">
                {currentUser.age}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-white/80 font-medium mt-0.5">
              <MapPin size={12} className="text-[#E85D2A]" />
              <span>{currentUser.location}</span>
            </div>
          </div>
        </div>

        {/* Profile Info Details */}
        <div className="p-5 space-y-4">
          {/* Bio */}
          {currentUser.bio ? (
            <p className="text-xs text-[#333333] leading-relaxed whitespace-pre-line font-normal">
              {currentUser.bio}
            </p>
          ) : (
            <p className="text-xs text-[#7A766E] italic">
              No bio added yet. Add a short bio to introduce yourself.
            </p>
          )}

          {/* Seeking & Interests */}
          <div className="space-y-2.5">
            {currentUser.lookingFor && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A766E]">
                  Seeking
                </span>
                <Badge variant="accent" size="sm">
                  {currentUser.lookingFor}
                </Badge>
              </div>
            )}

            {currentUser.interests && currentUser.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentUser.interests.map((interest, i) => (
                  <Badge key={i} variant="stone" size="sm">
                    {interest}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Prompts */}
          {currentUser.prompts && currentUser.prompts.length > 0 && (
            <div className="space-y-2.5">
              {currentUser.prompts.map(
                (p, idx) =>
                  p.answer && (
                    <div
                      key={idx}
                      className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#D9D6CF] text-xs space-y-1"
                    >
                      <div className="text-[11px] font-bold text-[#17352F]">
                        <span>{p.question}</span>
                      </div>
                      <p className="text-[#222222] italic">"{p.answer}"</p>
                    </div>
                  )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Management Actions */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E] px-1">
          Profile Management
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={onEditProfile}
            icon={<Edit3 size={15} />}
          >
            Edit Profile
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={onEditPhotos}
            icon={<Camera size={15} />}
          >
            Manage Photos
          </Button>
        </div>

        <button
          type="button"
          onClick={onEditPreferences}
          className="w-full p-4 bg-[#FFFFFF] rounded-2xl border border-[#D9D6CF] flex items-center justify-between hover:bg-[#FAF8F4] transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#FAF8F4] border border-[#D9D6CF] text-[#111111]">
              <Sliders size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#111111]">
                Dating Preferences
              </p>
              <p className="text-[11px] text-[#7A766E]">
                Age range, gender, and discovery scope
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#7A766E]">→</span>
        </button>

        <button
          type="button"
          onClick={onEditWhatsApp}
          className="w-full p-4 bg-[#FFFFFF] rounded-2xl border border-[#D9D6CF] flex items-center justify-between hover:bg-[#FAF8F4] transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#EAF1EF] border border-[#C5DCD6] text-[#17352F]">
              <MessageCircle size={16} className="text-[#25D366]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-[#111111]">
                  WhatsApp Connection
                </p>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    currentUser.allowWhatsApp
                      ? 'bg-[#EAF1EF] text-[#17352F] border border-[#C5DCD6]'
                      : 'bg-[#EBE8E1] text-[#7A766E]'
                  }`}
                >
                  {currentUser.allowWhatsApp ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-[#7A766E]">
                Allow matches to connect with you on WhatsApp
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#7A766E]">→</span>
        </button>
      </div>
    </div>
  );
};


