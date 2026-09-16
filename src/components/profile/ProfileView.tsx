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
            <h2 className="text-xl font-black text-[var(--color-ink)] tracking-tight font-sans">
              Your Profile
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-stone-dark)] font-medium">
              <span>Guest Mode · Not logged in</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="p-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-ink)] hover:bg-[var(--color-stone-light)] transition-colors cursor-pointer"
            title="Account Settings & Safety"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Guest Intro Card */}
        <div className="bg-[var(--color-surface)] rounded-[28px] border border-[var(--color-border)] p-6 shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-arrow-orange-text)] mx-auto shadow-2xs">
            <User size={26} />
          </div>

          <div className="text-center space-y-1.5">
            <h3 className="text-xl font-black text-[var(--color-ink)] tracking-tight">
              Create Your Identity
            </h3>
            <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed max-w-sm mx-auto">
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
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-stone-dark)] px-1">
            ARROW Account Features
          </h4>

          <div className="p-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[var(--color-forest-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-forest)]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-ink)]">18+ Human Verification</p>
              <p className="text-[11px] text-[var(--color-stone-dark)]">
                Genuine adult community with verified age standards.
              </p>
            </div>
          </div>

          <div className="p-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[#25D366]">
              <MessageCircle size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-ink)]">Permission-Based WhatsApp</p>
              <p className="text-[11px] text-[var(--color-stone-dark)]">
                Direct number sharing unlocked only upon mutual match.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const photos = currentUser.photos && currentUser.photos.length > 0
    ? currentUser.photos : [];

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Settings Trigger */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-xl font-black text-[var(--color-ink)] tracking-tight font-sans">
            Your Profile
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-forest)] font-bold">
            <ShieldCheck size={14} className="text-[var(--color-forest)]" />
            <span>18+ Verified Human Account</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-ink)] hover:bg-[var(--color-stone-light)] transition-colors cursor-pointer"
          title="Account Settings"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Main Profile Card Preview */}
      <div className="bg-[var(--color-surface)] rounded-[28px] border border-[var(--color-border)] overflow-hidden shadow-xs">
        {/* Photo Gallery Banner */}
        <div className="relative aspect-[4/3] bg-[var(--color-stone-light)]">
          {photos[0] ? (
            <img
              src={photos[0]}
              alt={currentUser.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <button
              type="button"
              onClick={onEditPhotos}
              className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--color-stone-dark)] hover:text-[var(--color-ink)] transition-colors"
            >
              <Camera size={28} />
              <span className="text-xs font-bold uppercase tracking-widest">Add your first photo</span>
              <span className="text-[11px]">Profiles with photos get far more arrows</span>
            </button>
          )}
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
              <MapPin size={12} className="text-[var(--color-arrow-orange-text)]" />
              <span>{currentUser.location}</span>
            </div>
          </div>
        </div>

        {/* Profile Info Details */}
        <div className="p-5 space-y-4">
          {/* Bio */}
          {currentUser.bio ? (
            <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-line font-normal">
              {currentUser.bio}
            </p>
          ) : (
            <p className="text-xs text-[var(--color-stone-dark)] italic">
              No bio added yet. Add a short bio to introduce yourself.
            </p>
          )}

          {/* Seeking & Interests */}
          <div className="space-y-2.5">
            {currentUser.lookingFor && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">
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
                      className="p-3.5 bg-[var(--color-surface-subtle)] rounded-2xl border border-[var(--color-border)] text-xs space-y-1"
                    >
                      <div className="text-[11px] font-bold text-[var(--color-forest)]">
                        <span>{p.question}</span>
                      </div>
                      <p className="text-[var(--color-ink-soft)] italic">"{p.answer}"</p>
                    </div>
                  )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Management Actions */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-stone-dark)] px-1">
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
          className="w-full p-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] flex items-center justify-between hover:bg-[var(--color-surface-subtle)] transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-ink)]">
              <Sliders size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-ink)]">
                Dating Preferences
              </p>
              <p className="text-[11px] text-[var(--color-stone-dark)]">
                Age range, gender, and discovery scope
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[var(--color-stone-dark)]">→</span>
        </button>

        <button
          type="button"
          onClick={onEditWhatsApp}
          className="w-full p-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] flex items-center justify-between hover:bg-[var(--color-surface-subtle)] transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[var(--color-forest-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-forest)]">
              <MessageCircle size={16} className="text-[#25D366]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-[var(--color-ink)]">
                  WhatsApp Connection
                </p>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    currentUser.allowWhatsApp
                      ? 'bg-[var(--color-forest-subtle)] text-[var(--color-forest)] border border-[var(--color-border-subtle)]'
                      : 'bg-[var(--color-stone-light)] text-[var(--color-stone-dark)]'
                  }`}
                >
                  {currentUser.allowWhatsApp ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-stone-dark)]">
                Allow matches to connect with you on WhatsApp
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[var(--color-stone-dark)]">→</span>
        </button>
      </div>
    </div>
  );
};


