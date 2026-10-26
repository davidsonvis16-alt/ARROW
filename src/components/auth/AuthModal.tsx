import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { authService } from '../../services/authService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { storageService } from '../../services/storageService';
import { useToast } from '../ui/Toast';
import { Logo, CreatedByEden } from '../brand/Logo';
import { LegalDocType } from '../safety/LegalModal';
import { AlertCircle, Eye, EyeOff, Loader2, LogOut, MailCheck, ShieldCheck, UserPlus } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  /** Signed in. The app decides whether that means onboarding or home. */
  onAuthenticated: () => void;
  onSelectProfile: (user: UserProfile) => void;
  onStartOnboarding: () => void;
  onLogOut: () => void;
  onOpenLegal: (type: LegalDocType) => void;
  onOpenPlans: () => void;
}

type Mode = 'signup' | 'signin' | 'reset' | 'check-email';

/** Supabase's raw auth errors, rewritten for people. */
function friendlyAuthError(err: unknown): string {
  const message = (err as { message?: string })?.message || '';
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match. Try again or reset your password.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first — check your inbox for the link we sent.';
  if (/already registered|already exists/i.test(message)) return 'There is already an account with that email. Log in instead.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/password should be|weak password/i.test(message)) return 'Choose a stronger password: at least 8 characters, mixing letters and numbers.';
  if (/network|fetch/i.test(message)) return 'Could not connect. Check your internet and try again.';
  return message || 'Something went wrong. Please try again.';
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/**
 * The single front door: create an account or log in, in one sheet.
 *
 * Google is offered first because it is one tap and needs no password or
 * confirmation email. Email works too, and switching between "create" and
 * "log in" keeps whatever you already typed.
 */
export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthenticated,
  onSelectProfile,
  onStartOnboarding,
  onLogOut,
  onOpenLegal,
  onOpenPlans,
}) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | 'resend' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setPassword('');
      setShowPassword(false);
      setLoading(null);
      setMode((m) => (m === 'check-email' ? 'signin' : m));
    }
  }, [isOpen]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) {
      setError('Enter your email address.');
      return;
    }

    setLoading('email');
    setError('');
    try {
      if (mode === 'reset') {
        await authService.resetPassword(address);
        // Worded so it reveals nothing about whether the address has an
        // account: on a dating site, "no such user" tells a stranger whether
        // someone is a member.
        showToast('If that address has an account, a reset link is on its way.', 'success');
        switchMode('signin');
        return;
      }

      if (password.length < 8) {
        setError(mode === 'signup' ? 'Use at least 8 characters for your password.' : 'Enter your password.');
        return;
      }

      if (mode === 'signup') {
        const result = await authService.signUp({
          email: address,
          password,
          name: address.split('@')[0],
          dateOfBirth: '',
          gender: 'woman',
        });

        if (result.session) {
          onAuthenticated();
        } else {
          // Email confirmation is on for this project.
          switchMode('check-email');
        }
      } else {
        await authService.signIn(address, password);
        onAuthenticated();
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    setError('');
    try {
      // Leaves the page; the app picks the session up when Google sends them back.
      await authService.signInWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
      setLoading(null);
    }
  };

  const handleResend = async () => {
    setLoading('resend');
    try {
      await authService.resendEmailVerification(email.trim());
      showToast('Sent again. It can take a minute — check spam too.', 'success');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(null);
    }
  };

  // ------------------------------------------------------------ signed in
  if (currentUser) {
    const savedProfiles = isSupabaseConfigured ? [] : storageService.getAllProfiles();

    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Your account" maxWidth="sm">
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[var(--color-stone-light)] shrink-0 flex items-center justify-center">
              {currentUser.photos[0] ? (
                <img src={currentUser.photos[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-xl font-black text-[var(--color-stone-dark)]">{currentUser.name.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-base font-black text-[var(--color-ink)] truncate">{currentUser.name}</p>
                {currentUser.isVerifiedAdult && <ShieldCheck size={15} className="text-[var(--color-forest)] shrink-0" />}
              </div>
              <p className="text-xs text-[var(--color-stone-dark)] truncate">{currentUser.location}</p>
            </div>
          </div>

          {/* Several profiles only exist in the offline demo, where they are
              all stored on this device. A real account is one person. */}
          {savedProfiles.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">
                Other profiles on this device
              </p>
              {savedProfiles
                .filter((p) => p.id !== currentUser.id)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProfile(p);
                      onClose();
                    }}
                    className="w-full p-2.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-left text-sm font-bold text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors"
                  >
                    Switch to {p.name}
                  </button>
                ))}
            </div>
          )}

          <Button
            variant="outline"
            fullWidth
            icon={<LogOut size={16} />}
            onClick={() => {
              onLogOut();
              onClose();
            }}
          >
            Log out
          </Button>
        </div>
      </Modal>
    );
  }

  // ---------------------------------------------------- offline demo mode
  if (!isSupabaseConfigured) {
    const savedProfiles = storageService.getAllProfiles();
    return (
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm" showCloseButton>
        <div className="space-y-5 text-center">
          <Logo size="lg" className="justify-center" />
          <p className="text-sm text-[var(--color-stone-dark)]">
            This copy of ARROW is not connected to a server yet, so profiles are kept on this
            device only.
          </p>
          <Button variant="primary" fullWidth icon={<UserPlus size={16} />} onClick={onStartOnboarding}>
            Create a profile
          </Button>
          {savedProfiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelectProfile(p);
                onClose();
              }}
              className="w-full p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-sm font-bold text-[var(--color-ink)]"
            >
              Continue as {p.name}
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  // ------------------------------------------------------- check your email
  if (mode === 'check-email') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
        <div className="space-y-5 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--color-forest-subtle)] text-[var(--color-forest)] flex items-center justify-center">
            <MailCheck size={26} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-black tracking-tight text-[var(--color-ink)]">Check your inbox</h3>
            <p className="text-sm text-[var(--color-stone-dark)] leading-relaxed">
              We sent a link to <span className="font-bold text-[var(--color-ink)]">{email.trim()}</span>. Tap it
              to confirm your email, then come back and log in.
            </p>
          </div>
          {error && <p className="text-xs text-[var(--color-danger-text)]">{error}</p>}
          <div className="space-y-2">
            <Button variant="primary" fullWidth onClick={() => switchMode('signin')}>
              I've confirmed — log in
            </Button>
            <Button variant="ghost" fullWidth onClick={handleResend} disabled={loading === 'resend'}>
              {loading === 'resend' ? 'Sending…' : 'Send the link again'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // -------------------------------------------------------------- the door
  const heading =
    mode === 'signup' ? 'Create your account' : mode === 'signin' ? 'Welcome back' : 'Reset your password';

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <Logo size="lg" className="justify-center" />
          <h2 className="text-lg font-black tracking-tight text-[var(--color-ink)]">{heading}</h2>
        </div>

        {mode !== 'reset' && (
          <div className="grid grid-cols-2 p-1 rounded-[var(--radius-pill)] bg-[var(--color-stone-light)]" role="tablist">
            {(['signup', 'signin'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`py-2 rounded-[var(--radius-pill)] text-sm font-bold transition-all ${
                  mode === m
                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-subtle)]'
                    : 'text-[var(--color-stone-dark)]'
                }`}
              >
                {m === 'signup' ? 'Sign up' : 'Log in'}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-2xl bg-[var(--color-danger-subtle)] flex items-start gap-2 text-xs text-[var(--color-danger-text)]" role="alert">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mode !== 'reset' && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading !== null}
              className="w-full py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-ink)] text-sm font-bold flex items-center justify-center gap-2.5 hover:border-[var(--color-ink)] active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {loading === 'google' ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-[11px] font-semibold text-[var(--color-stone-dark)]">or use email</span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>
          </>
        )}

        <form onSubmit={handleEmail} className="space-y-3" noValidate>
          <div className="space-y-1">
            <label htmlFor="auth-email" className="text-xs font-bold text-[var(--color-ink)]">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] text-[var(--color-ink)] placeholder:text-[var(--color-stone-dark)] focus:outline-none focus:border-[var(--color-arrow-orange)]"
            />
          </div>

          {mode !== 'reset' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className="text-xs font-bold text-[var(--color-ink)]">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-xs font-semibold text-[var(--color-arrow-orange-text)]"
                  >
                    Forgot it?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-12 py-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] text-[var(--color-ink)] placeholder:text-[var(--color-stone-dark)] focus:outline-none focus:border-[var(--color-arrow-orange)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-stone-dark)] hover:text-[var(--color-ink)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed">
              Enter the email you signed up with and we'll send a link to choose a new password.
            </p>
          )}

          <button
            type="submit"
            disabled={loading !== null}
            className="w-full py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-arrow-orange)] hover:bg-[var(--color-arrow-orange-hover)] text-white text-sm font-black active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading === 'email' && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Log in' : 'Send reset link'}
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="w-full text-xs font-semibold text-[var(--color-stone-dark)] py-1"
            >
              Back to log in
            </button>
          )}
        </form>

        <p className="text-[11px] text-center leading-relaxed text-[var(--color-stone-dark)]">
          By continuing you confirm you are 18 or older and agree to our{' '}
          <button type="button" className="underline font-semibold text-[var(--color-ink)]" onClick={() => onOpenLegal('terms')}>
            Terms
          </button>{' '}
          and{' '}
          <button type="button" className="underline font-semibold text-[var(--color-ink)]" onClick={() => onOpenLegal('privacy')}>
            Privacy Policy
          </button>
          .
        </p>

        <button
          type="button"
          onClick={onOpenPlans}
          className="w-full text-center text-xs font-bold text-[var(--color-ink)]"
        >
          Free to join · <span className="text-[var(--color-arrow-orange-text)] underline">See plans &amp; pricing</span>
        </button>

        <CreatedByEden className="text-center" />
      </div>
    </Modal>
  );
};
