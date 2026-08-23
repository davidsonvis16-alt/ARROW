import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { authService } from '../../services/authService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { storageService } from '../../services/storageService';
import { useToast } from '../ui/Toast';
import {
  User,
  UserPlus,
  LogIn,
  LogOut,
  ShieldCheck,
  KeyRound,
  Mail,
  Lock,
  Database,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onSelectProfile: (user: UserProfile) => void;
  onStartOnboarding: () => void;
  onLogOut: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectProfile,
  onStartOnboarding,
  onLogOut,
}) => {
  const { showToast } = useToast();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset' | 'overview'>('overview');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSavedProfiles(storageService.getAllProfiles());
      setErrorMsg('');
      if (!currentUser) {
        setAuthMode('overview');
      }
    }
  }, [isOpen, currentUser]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isSupabaseConfigured) {
        await authService.signIn(email.trim(), password);
        showToast('Signed in successfully with Supabase Auth', 'success');
        onClose();
      } else {
        // Find existing local profile by email or name
        const match = savedProfiles.find(
          (p) => p.name.toLowerCase() === email.toLowerCase() || p.id === email
        );
        if (match) {
          onSelectProfile(match);
          showToast(`Welcome back, ${match.name}!`, 'success');
          onClose();
        } else {
          setErrorMsg('Supabase is not configured with real API keys yet. You can create a profile to explore.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isSupabaseConfigured) {
        await authService.signInWithGoogle();
      } else {
        showToast('Google Sign-In requires active Supabase Auth credentials', 'info');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isSupabaseConfigured) {
        await authService.resetPassword(email.trim());
        showToast('Password reset link sent to your email', 'success');
        setAuthMode('signin');
      } else {
        showToast('Password reset requires active Supabase Auth credentials', 'info');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentUser ? 'Account & Session' : 'Welcome to ARROW'}
      subtitle={currentUser ? 'Manage active session and credentials' : 'Human Dating & Verified Discovery'}
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Supabase Status Pill */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF8F4] border border-[#D9D6CF]">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${isSupabaseConfigured ? 'bg-[#17352F]' : 'bg-[#E85D2A]'}`} />
            <div>
              <p className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                <Database size={13} className="text-[#17352F]" />
                <span>Backend: {isSupabaseConfigured ? 'Supabase Connected' : 'Configuration Ready'}</span>
              </p>
              <p className="text-[10px] text-[#7A766E]">
                {isSupabaseConfigured
                  ? 'Real-time PostgreSQL database, RLS & Storage active'
                  : 'Add VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY to .env.local'}
              </p>
            </div>
          </div>
          {!isSupabaseConfigured && (
            <span className="text-[10px] font-bold text-[#E85D2A] bg-[#FAF8F4] border border-[#E85D2A]/30 px-2 py-0.5 rounded-full">
              Setup Guide Ready
            </span>
          )}
        </div>

        {/* LOGGED IN USER CARD */}
        {currentUser ? (
          <div className="space-y-5">
            <div className="p-4 bg-white rounded-2xl border border-[#D9D6CF] flex items-center gap-4 shadow-xs">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-stone-700 shrink-0 border border-[#D9D6CF]">
                <img
                  src={
                    currentUser.photos[0] ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
                  }
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-base font-bold text-[#111111] truncate">
                    {currentUser.name}, {currentUser.age}
                  </h4>
                  <ShieldCheck size={16} className="text-[#17352F] shrink-0" />
                </div>
                <p className="text-xs text-[#7A766E] truncate">{currentUser.location}</p>
                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#17352F] mt-1 bg-[#EAF1EF] border border-[#C5DCD6] px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#17352F]" />
                  <span>Active Session</span>
                </div>
              </div>
            </div>

            {/* Switch Saved Profile if available */}
            {savedProfiles.length > 1 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E]">
                  Switch Active Profile
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                  {savedProfiles
                    .filter((p) => p.id !== currentUser.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onSelectProfile(p);
                          onClose();
                          showToast(`Switched to ${p.name}`, 'info');
                        }}
                        className="w-full p-2.5 bg-white hover:bg-[#FAF8F4] border border-[#D9D6CF] rounded-2xl flex items-center justify-between transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                            <img
                              src={
                                p.photos[0] ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                              }
                              alt={p.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#111111]">
                              {p.name}, {p.age}
                            </p>
                            <p className="text-[10px] text-[#7A766E]">{p.location}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#E85D2A] flex items-center gap-1">
                          <span>Select</span>
                          <ChevronRight size={13} />
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2 border-t border-[#D9D6CF]">
              <Button
                variant="outline"
                fullWidth
                icon={<UserPlus size={16} />}
                onClick={() => {
                  onClose();
                  onStartOnboarding();
                }}
              >
                Create Another Profile
              </Button>

              <Button
                variant="ghost"
                fullWidth
                icon={<LogOut size={16} className="text-stone-600" />}
                onClick={async () => {
                  if (isSupabaseConfigured) {
                    try {
                      await authService.signOut();
                    } catch (e) {
                      console.warn(e);
                    }
                  }
                  onLogOut();
                  onClose();
                }}
              >
                Log Out to Guest Mode
              </Button>
            </div>
          </div>
        ) : (
          /* GUEST / LOGGED-OUT STATES */
          <div className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {authMode === 'overview' && (
              <div className="space-y-4">
                {/* Primary CTA: Create Profile */}
                <div className="space-y-2">
                  <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    arrow="right"
                    icon={<UserPlus size={18} />}
                    onClick={() => {
                      onClose();
                      onStartOnboarding();
                    }}
                  >
                    Create New Profile (18+)
                  </Button>
                  <p className="text-[11px] text-center text-[#7A766E]">
                    Instant setup · Photo upload & Age verification
                  </p>
                </div>

                {/* Secondary Option: Email / Password Log In */}
                <div className="pt-3 border-t border-[#D9D6CF] space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                    Existing Account
                  </h4>
                  <Button
                    variant="outline"
                    fullWidth
                    icon={<LogIn size={16} />}
                    onClick={() => setAuthMode('signin')}
                  >
                    Log In with Email & Password
                  </Button>
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    Continue with Google
                  </Button>
                </div>

                {/* Saved Profiles on this device if any exist */}
                {savedProfiles.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#D9D6CF]">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E]">
                      Saved Profiles on Device
                    </h4>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                      {savedProfiles.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onSelectProfile(p);
                            onClose();
                            showToast(`Logged in as ${p.name}`, 'success');
                          }}
                          className="w-full p-2.5 bg-white hover:bg-[#FAF8F4] border border-[#D9D6CF] rounded-2xl flex items-center justify-between transition-colors cursor-pointer text-left group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl overflow-hidden bg-stone-200 shrink-0 border border-[#D9D6CF]">
                              <img
                                src={
                                  p.photos[0] ||
                                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                                }
                                alt={p.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span className="text-xs font-bold text-[#111111] group-hover:text-[#E85D2A] transition-colors">
                              {p.name}, {p.age}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-[#111111] group-hover:text-[#E85D2A] flex items-center gap-1">
                            <span>Log In</span>
                            <ArrowRight size={13} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SIGN IN FORM */}
            {authMode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#111111]">Email Address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A766E]" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border border-[#D9D6CF] bg-white text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#111111]">Password</label>
                      <button
                        type="button"
                        onClick={() => setAuthMode('reset')}
                        className="text-[11px] font-semibold text-[#E85D2A] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A766E]" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border border-[#D9D6CF] bg-white text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    disabled={loading}
                    icon={loading ? undefined : <LogIn size={16} />}
                  >
                    {loading ? 'Authenticating...' : 'Log In'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => setAuthMode('overview')}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}

            {/* PASSWORD RESET FORM */}
            {authMode === 'reset' && (
              <form onSubmit={handlePasswordReset} className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#111111]">Account Email</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A766E]" />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border border-[#D9D6CF] bg-white text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[#7A766E]">
                    We'll send a secure password reset link to this email address.
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    disabled={loading}
                    icon={loading ? undefined : <KeyRound size={16} />}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => setAuthMode('signin')}
                  >
                    Back to Log In
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
