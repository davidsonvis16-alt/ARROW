import React, { useEffect, useState } from 'react';
import { BlockedProfile } from '../../types';
import { api } from '../../services/api';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import { Loader2, UserX, EyeOff, Eye, Moon, Sun, Monitor } from 'lucide-react';
import { ThemePreference, useTheme } from '../../hooks/useTheme';

interface SafetySectionProps {
  isPaused: boolean;
  showOnlineStatus: boolean;
  onTogglePause: (paused: boolean) => Promise<void>;
  onToggleOnlineStatus?: (show: boolean) => Promise<void>;
}

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  control: React.ReactNode;
}> = ({ icon, title, description, control }) => (
  <div className="flex items-start gap-3 py-3">
    <span className="mt-0.5 text-[var(--color-stone-dark)] shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-[var(--color-ink)]">{title}</p>
      <p className="text-[11px] text-[var(--color-stone-dark)] leading-relaxed">{description}</p>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

const Switch: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({
  checked,
  onChange,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`w-11 h-6 rounded-full relative transition-colors ${
      checked ? 'bg-[var(--color-forest)]' : 'bg-[var(--color-border)]'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : ''
      }`}
    />
  </button>
);

const THEMES: Array<{ value: ThemePreference; icon: React.ReactNode; label: string }> = [
  { value: 'system', icon: <Monitor size={13} />, label: 'System' },
  { value: 'light', icon: <Sun size={13} />, label: 'Light' },
  { value: 'dark', icon: <Moon size={13} />, label: 'Dark' },
];

/**
 * Safety and privacy controls, gathered in one place.
 *
 * Blocking used to be a one-way door: you could block someone from their
 * profile, but there was no list and no way back. That makes people reluctant
 * to use the control at all, which is the opposite of what a safety feature
 * should do.
 */
export const SafetySection: React.FC<SafetySectionProps> = ({
  isPaused,
  showOnlineStatus,
  onTogglePause,
  onToggleOnlineStatus,
}) => {
  const { showToast } = useToast();
  const { preference, setPreference } = useTheme();

  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getBlockedProfiles()
      .then((list) => active && setBlocked(list))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const unblock = async (profile: BlockedProfile) => {
    setBusyId(profile.id);
    try {
      await api.unblockUser(profile.id);
      setBlocked((prev) => prev.filter((b) => b.id !== profile.id));
      showToast(`${profile.name} unblocked`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Could not unblock', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-subtle)] px-3.5 divide-y divide-[var(--color-border-subtle)]">
        <Row
          icon={isPaused ? <EyeOff size={15} /> : <Eye size={15} />}
          title="Pause my profile"
          description="Hide yourself from discovery. You keep your matches and conversations."
          control={
            <Switch
              checked={isPaused}
              onChange={() => onTogglePause(!isPaused)}
              label="Pause my profile"
            />
          }
        />

        <Row
          icon={<Eye size={15} />}
          title="Show when I was active"
          description="Turn this off and nobody sees your activity — you stop seeing theirs too."
          control={
            <Switch
              checked={showOnlineStatus}
              onChange={() => onToggleOnlineStatus?.(!showOnlineStatus)}
              label="Show when I was active"
            />
          }
        />

        <div className="py-3 space-y-2">
          <p className="text-xs font-bold text-[var(--color-ink)]">Appearance</p>
          <div className="flex p-1 bg-[var(--color-surface-subtle)] rounded-[var(--radius-input)] border border-[var(--color-border-subtle)]">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                onClick={() => setPreference(theme.value)}
                aria-pressed={preference === theme.value}
                className={`flex-1 py-1.5 rounded-[10px] text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  preference === theme.value
                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-subtle)]'
                    : 'text-[var(--color-stone-dark)] hover:text-[var(--color-ink)]'
                }`}
              >
                {theme.icon}
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">
          Blocked accounts
        </h4>

        {isLoading ? (
          <div className="flex items-center gap-2 p-3.5 text-xs text-[var(--color-stone-dark)]">
            <Loader2 size={14} className="animate-spin" />
            <span>Loading</span>
          </div>
        ) : blocked.length === 0 ? (
          <p className="p-3.5 bg-[var(--color-surface-subtle)] rounded-2xl border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-stone-dark)] leading-relaxed">
            You have not blocked anyone. Blocking is symmetric and immediate: you both
            disappear from each other's discovery, likes and matches.
          </p>
        ) : (
          <ul className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-subtle)] divide-y divide-[var(--color-border-subtle)] overflow-hidden">
            {blocked.map((profile) => (
              <li key={profile.id} className="flex items-center gap-3 p-3">
                <Avatar name={profile.name} src={profile.photo} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--color-ink)] truncate">{profile.name}</p>
                  <p className="text-[10px] text-[var(--color-stone-dark)]">
                    Blocked {new Date(profile.blockedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => unblock(profile)}
                  disabled={busyId === profile.id}
                  className="px-3 py-1.5 rounded-[var(--radius-input)] border border-[var(--color-border)] text-[11px] font-bold text-[var(--color-stone-dark)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {busyId === profile.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <UserX size={12} />
                  )}
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
