import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { MIN_PASSCODE, secureService, SecureStatus } from '../../services/secureService';
import { WrongPasscodeError } from '../../lib/e2ee';
import { KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';

interface SecureContextValue {
  status: SecureStatus;
  /**
   * Resolves true once secure chat is ready on this device, asking for the
   * passcode (or setting one up) if needed. False if the person backs out.
   */
  requireSecure: (reason?: string) => Promise<boolean>;
}

const SecureContext = createContext<SecureContextValue>({
  status: 'unavailable',
  requireSecure: async () => false,
});

export const useSecure = () => useContext(SecureContext);

/** Re-renders when secure chat locks, unlocks or is set up. */
export function useSecureStatus(): SecureStatus {
  const [status, setStatus] = useState<SecureStatus>(secureService.status);
  useEffect(() => secureService.subscribe(setStatus), []);
  return status;
}

/** Holds the passcode prompt. The signed-in user is set with secureService.init. */
export const SecureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const status = useSecureStatus();
  const [prompt, setPrompt] = useState<{ reason?: string } | null>(null);
  const waiter = useRef<((ok: boolean) => void) | null>(null);

  const requireSecure = useCallback(async (reason?: string) => {
    if (secureService.status === 'ready') return true;
    if (secureService.status === 'unavailable') return false;
    return new Promise<boolean>((resolve) => {
      waiter.current?.(false);
      waiter.current = resolve;
      setPrompt({ reason });
    });
  }, []);

  const finish = (ok: boolean) => {
    setPrompt(null);
    waiter.current?.(ok);
    waiter.current = null;
  };

  return (
    <SecureContext.Provider value={{ status, requireSecure }}>
      {children}
      <SecureChatModal
        isOpen={Boolean(prompt)}
        reason={prompt?.reason}
        status={status}
        onDone={() => finish(true)}
        onClose={() => finish(false)}
      />
    </SecureContext.Provider>
  );
};

const inputClass =
  'w-full px-3.5 py-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] sm:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-stone-dark)] focus:outline-none focus:border-[var(--color-forest)]';

const primaryClass =
  'w-full py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-forest)] text-[var(--color-offwhite)] text-sm font-black flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-60 hover:brightness-110';

/**
 * Set up secure chat (choose a passcode) or unlock it on a new device. The
 * passcode is used here, on the device, and is never sent anywhere.
 */
export const SecureChatModal: React.FC<{
  isOpen: boolean;
  reason?: string;
  status: SecureStatus;
  onDone: () => void;
  onClose: () => void;
}> = ({ isOpen, reason, status, onDone, onClose }) => {
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setConfirm('');
      setError(null);
      setResetting(false);
    }
  }, [isOpen]);

  const creating = status === 'needs-setup' || resetting;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (creating) {
      if (passcode.length < MIN_PASSCODE) return setError(`Use at least ${MIN_PASSCODE} characters.`);
      if (passcode !== confirm) return setError('The two passcodes do not match.');
    }

    setBusy(true);
    try {
      if (creating) await secureService.setup(passcode);
      else await secureService.unlock(passcode);
      onDone();
    } catch (err) {
      setError(err instanceof WrongPasscodeError ? err.message : (err as Error)?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="sm"
      title={creating ? (resetting ? 'Reset secure chat' : 'Set up secure chat') : 'Unlock secure chat'}
      subtitle={reason}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-3 p-3 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)]">
          <ShieldCheck size={18} className="shrink-0 text-[var(--color-forest)] mt-0.5" />
          <div className="text-xs text-[var(--color-ink)] leading-relaxed space-y-1.5">
            {resetting ? (
              <p>
                This makes you a new key. <strong>Messages, answers and games from before the reset can no longer be
                opened</strong> — on any device. Your matches stay.
              </p>
            ) : creating ? (
              <>
                <p>
                  Your messages, game answers and question answers are locked on your phone and only open on the
                  other person's. Not even Finderr can read them.
                </p>
                <p>
                  Choose a passcode to keep your key safe. You'll only need it on a new phone or browser.{' '}
                  <strong>It is never sent to us, so we cannot recover it.</strong>
                </p>
              </>
            ) : (
              <p>
                You're on a new device or browser. Enter your secure chat passcode to open your conversations here.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="secure-passcode" className="text-xs font-bold text-[var(--color-ink)]">
            {creating ? 'New passcode' : 'Passcode'}
          </label>
          <input
            id="secure-passcode"
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder={creating ? `At least ${MIN_PASSCODE} characters` : ''}
            className={inputClass}
            autoFocus
          />
          {creating && (
            <>
              <label htmlFor="secure-confirm" className="sr-only">
                Confirm passcode
              </label>
              <input
                id="secure-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                className={inputClass}
              />
              <p className="text-[11px] text-[var(--color-stone-dark)]">
                A short sentence is easier to remember and much harder to guess than a word.
              </p>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs font-semibold text-[var(--color-danger-text)]">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !passcode} className={primaryClass}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : creating ? <KeyRound size={16} /> : <Lock size={16} />}
          {busy ? 'Securing…' : creating ? (resetting ? 'Reset and continue' : 'Turn on secure chat') : 'Unlock'}
        </button>

        {status === 'locked' && !resetting && (
          <button
            type="button"
            onClick={() => {
              setResetting(true);
              setError(null);
            }}
            className="w-full text-center text-xs font-semibold text-[var(--color-stone-dark)] hover:text-[var(--color-danger-text)]"
          >
            Forgot your passcode? Reset secure chat
          </button>
        )}
      </form>
    </Modal>
  );
};

/**
 * Shows decrypted text, or a calm placeholder while it opens or if it cannot.
 * Plain text (from before secure chat) passes straight through.
 */
export function useOpened(partnerId: string | undefined, value: string | null | undefined): {
  text: string | null;
  error: string | null;
} {
  const status = useSecureStatus();
  const [state, setState] = useState<{ text: string | null; error: string | null }>({ text: null, error: null });

  useEffect(() => {
    let active = true;
    if (!value || !partnerId) {
      setState({ text: null, error: null });
      return;
    }
    secureService
      .openFrom(partnerId, value)
      .then((text) => active && setState({ text, error: null }))
      .catch((err) => active && setState({ text: null, error: (err as Error).message }));
    return () => {
      active = false;
    };
  }, [partnerId, value, status]);

  return state;
}
