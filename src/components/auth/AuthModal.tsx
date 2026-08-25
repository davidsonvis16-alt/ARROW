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
  LogOut,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  Mail,
  Lock,
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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<UserProfile[]>([]);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSavedProfiles(storageService.getAllProfiles());
      setErrorMsg('');
      setEmail('');
      setPassword('');
      setAuthMode('signup');
    }
  }, [isOpen]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (authMode === 'signup') {
        const result = await authService.signUp({
          email: email.trim(),
          password,
          name: email.split('@')[0],
          dateOfBirth: '',
          gender: 'woman',
        });

        if (result.user && result.session) {
          showToast('Account created successfully', 'success');
          onStartOnboarding();
        } else if (result.user) {
          showToast('Account created. Please verify your email, then log in.', 'success');
          setAuthMode('signin');
          setPassword('');
        } else {
          showToast('Account created. Please check your email.', 'success');
          setAuthMode('signin');
          setPassword('');
        }
      } else {
        const result = await authService.signIn(email.trim(), password);
        showToast('Signed in successfully', 'success');
        onStartOnboarding();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentUser ? 'Account & Session' : 'Welcome to ARROW'}
      subtitle={currentUser ? 'Manage active session and credentials' : 'Human Dating & Verified Discovery'}
      maxWidth="md"
    >
      <div className="space-y-5">
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
          <div className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                  Create Account
                </h4>
                {isSupabaseConfigured && (
                  <form onSubmit={handleEmailAuth} className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#111111]">Email</label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#111111]">Password</label>
                      <input
                        type="password"
                        required
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111]"
                      />
                    </div>
                    <Button
                      variant="primary"
                      fullWidth
                      type="submit"
                      disabled={loading}
                    >
                      {authMode === 'signup' ? 'Create Account' : 'Log In'}
                    </Button>
                  </form>
                )}

                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setAuthMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
                  disabled={loading}
                >
                  {authMode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Log in'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#E2DDD5]" />
                <span className="text-[10px] text-[#7A766E] font-semibold uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-[#E2DDD5]" />
              </div>

              <Button
                variant="outline"
                fullWidth
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                Continue with Google
              </Button>
            </div>

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
      </div>
    </Modal>
  );
};
