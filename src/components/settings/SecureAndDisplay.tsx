import React, { useState } from 'react';
import { MIN_PASSCODE, secureService } from '../../services/secureService';
import { useSecure } from '../secure/SecureChat';
import { useToast } from '../ui/Toast';
import { TextSize, useTextSize } from '../../hooks/useTextSize';
import { KeyRound, Loader2, ShieldCheck, Type } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[16px] sm:text-xs text-[var(--color-ink)]';

/** Settings → Secure chat: where it stands on this device, and the passcode. */
export const SecureChatSettings: React.FC = () => {
  const { status, requireSecure } = useSecure();
  const { showToast } = useToast();
  const [changing, setChanging] = useState(false);
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'unavailable') return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await secureService.changePasscode(oldCode, newCode);
      showToast('Secure chat passcode changed', 'success');
      setChanging(false);
      setOldCode('');
      setNewCode('');
    } catch (err) {
      showToast((err as Error).message || 'Could not change the passcode', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-forest-subtle)] text-[var(--color-forest)]">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--color-ink)]">Secure chat</p>
            <p className="text-[10px] text-[var(--color-stone-dark)]">
              {status === 'ready'
                ? 'On. Messages, game answers and question answers are end-to-end encrypted.'
                : status === 'locked'
                  ? 'Locked on this device. Enter your passcode to read your chats here.'
                  : 'Off. Turn it on to message your matches.'}
            </p>
          </div>
        </div>
        {status !== 'ready' ? (
          <button
            type="button"
            onClick={() => requireSecure()}
            className="text-xs font-bold text-[var(--color-arrow-orange-text)] hover:underline shrink-0"
          >
            {status === 'locked' ? 'Unlock' : 'Turn on'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setChanging((v) => !v)}
            className="text-xs font-bold text-[var(--color-arrow-orange-text)] hover:underline shrink-0"
          >
            {changing ? 'Cancel' : 'Change passcode'}
          </button>
        )}
      </div>

      {changing && (
        <form onSubmit={save} className="space-y-2 pt-3 border-t border-[var(--color-border-subtle)]">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current passcode"
            value={oldCode}
            onChange={(e) => setOldCode(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder={`New passcode (at least ${MIN_PASSCODE} characters)`}
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy || !oldCode || newCode.length < MIN_PASSCODE}
            className="w-full py-2.5 rounded-xl bg-[var(--color-forest)] text-[var(--color-offwhite)] text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Save new passcode
          </button>
          <p className="text-[10px] text-[var(--color-stone-dark)] leading-relaxed">
            Your passcode never leaves this device. Finderr cannot see it or recover it.
          </p>
        </form>
      )}
    </div>
  );
};

const SIZES: Array<{ value: TextSize; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Large' },
  { value: 'larger', label: 'Larger' },
];

/** Settings → Display: a bigger interface for anyone who wants one. */
export const DisplaySettings: React.FC = () => {
  const { size, setSize } = useTextSize();

  return (
    <div className="p-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-stone-light)] text-[var(--color-ink)]">
          <Type size={16} />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--color-ink)]">Text size</p>
          <p className="text-[10px] text-[var(--color-stone-dark)]">Makes everything on Finderr bigger and easier to tap</p>
        </div>
      </div>
      <div className="flex p-1 bg-[var(--color-surface-subtle)] rounded-[var(--radius-input)] border border-[var(--color-border-subtle)]" role="radiogroup" aria-label="Text size">
        {SIZES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={size === option.value}
            onClick={() => setSize(option.value)}
            className={`flex-1 py-2 rounded-[10px] font-bold transition-all ${
              option.value === 'standard' ? 'text-xs' : option.value === 'large' ? 'text-sm' : 'text-base'
            } ${
              size === option.value
                ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-subtle)]'
                : 'text-[var(--color-stone-dark)] hover:text-[var(--color-ink)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
