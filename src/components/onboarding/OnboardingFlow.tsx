import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { calculateAge, isAdult } from '../../services/storageService';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { authService } from '../../services/authService';
import { profileService } from '../../services/profileService';
import { useToast } from '../ui/Toast';
import {
  ShieldAlert,
  Camera,
  Upload,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Lock,
  Chrome,
  RefreshCw,
} from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: (profile: UserProfile) => void;
  onCancel?: () => void;
}

const AVAILABLE_INTERESTS = [
  'Architecture',
  'Photography',
  'Running',
  'Vinyl & Music',
  'Coffee',
  'Cinema',
  'Art & Design',
  'Hiking',
  'Writing',
  'Culinary',
  'Travel',
  'Books',
  'Cycling',
  'Philosophy',
];

const LOOKING_FOR_OPTIONS = [
  'Long-term connection',
  'Meaningful dating',
  'Casual & open',
  'Deep conversations',
  'Activity partner',
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google OAuth: if user is already authenticated, reuse session
  const [existingAuthUserId, setExistingAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');

  // Email/password auth
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Step 1: Google Sign-In + basic identity
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'woman' | 'man' | 'non-binary'>('woman');
  const [location, setLocation] = useState('');

  // Step 2: Email verification
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  // Step 3: Age verification
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [hasConfirmedAge, setHasConfirmedAge] = useState(false);
  const [isVerifyingAge, setIsVerifyingAge] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // Step 4: Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Step 5: Bio, Looking for & Interests
  const [bio, setBio] = useState('');
  const [lookingFor, setLookingFor] = useState('Meaningful dating');
  const [interests, setInterests] = useState<string[]>(['Architecture', 'Coffee']);

  // Step 6: WhatsApp Option & Completion
  const [allowWhatsApp, setAllowWhatsApp] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const calculatedAge = dateOfBirth ? calculateAge(dateOfBirth) : 0;
  const isEligibleAdult = isAdult(dateOfBirth);

  // Check for existing Google OAuth session
  useEffect(() => {
    if (isSupabaseConfigured) {
      authService.getCurrentUser().then((user) => {
        if (user) {
          setExistingAuthUserId(user.id);
          setAuthEmail(user.email || '');
        }
      });
    }
  }, []);

  const handleGoogleSignUp = async () => {
    setIsSubmitting(true);
    try {
      await authService.signInWithGoogle();
    } catch (err: any) {
      showToast(err.message || 'Failed to sign in with Google', 'error');
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail.trim() || !signupPassword.trim()) {
      showToast('Please enter email and password', 'warning');
      return;
    }
    if (signupPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await authService.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        name: name.trim() || signupEmail.split('@')[0],
        dateOfBirth: '',
        gender,
        location: location.trim() || null,
      });

      if (user) {
        setExistingAuthUserId(user.id);
        setAuthEmail(signupEmail.trim());
        showToast('Account created. Please verify your email.', 'success');
        setSignupPassword('');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create account', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createMinimalProfile = async (userId: string) => {
    if (!supabase) return;
    await supabase.from('arrow_profiles').upsert({
      id: userId,
      name: name.trim() || 'Arrow User',
      gender,
      location: location.trim() || null,
      is_verified_adult: false,
    });
    await supabase.from('arrow_preferences').upsert({
      user_id: userId,
      age_min: 18,
      age_max: 65,
      gender_preference: ['woman', 'man', 'non-binary'],
      intentions: ['Meaningful dating'],
    });
  };

  const checkEmailVerificationStatus = async () => {
    setIsCheckingVerification(true);
    try {
      const verified = await authService.checkEmailVerification();
      setIsEmailVerified(verified);
      if (!verified) {
        showToast('Please verify your email to continue', 'warning');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to check verification status', 'error');
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!authEmail) return;
    setIsCheckingVerification(true);
    try {
      await authService.resendEmailVerification(authEmail);
      showToast('Verification email sent. Please check your inbox.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to resend verification email', 'error');
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      if (!existingAuthUserId) {
        showToast('Please sign in or create an account to continue', 'warning');
        return;
      }
      if (!name.trim()) {
        showToast('Please enter your name', 'warning');
        return;
      }
      if (!location.trim()) {
        showToast('Please enter your general city or location', 'warning');
        return;
      }
      await createMinimalProfile(existingAuthUserId);
      await checkEmailVerificationStatus();
      if (isEmailVerified) {
        setStep(3);
      } else {
        setStep(2);
      }
      return;
    }

    if (step === 2) {
      if (!isEmailVerified) {
        showToast('Please verify your email before continuing', 'warning');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!dateOfBirth) {
        showToast('Please enter your date of birth', 'warning');
        return;
      }
      if (!isEligibleAdult) {
        showToast('ARROW is strictly for verified adults aged 18 and older', 'error');
        return;
      }
      if (!hasConfirmedAge) {
        showToast('Please confirm that you are 18 years old or older', 'warning');
        return;
      }

      setIsVerifyingAge(true);
      setVerificationError('');
      try {
        const result = await authService.completeAgeVerification(dateOfBirth);
        if (result.success) {
          showToast(`Age verified successfully (${result.age} years old)`, 'success');
          setStep(4);
        } else {
          setVerificationError(result.error || 'Age verification failed');
          showToast(result.error || 'Age verification failed', 'error');
        }
      } catch (err: any) {
        const msg = err.message || 'Age verification failed';
        setVerificationError(msg);
        showToast(msg, 'error');
      } finally {
        setIsVerifyingAge(false);
      }
      return;
    }

    if (step === 4) {
      if (photos.length === 0) {
        showToast('Please add at least one portrait photo', 'warning');
        return;
      }
    }

    if (step === 5) {
      if (interests.length === 0) {
        showToast('Please pick at least 1 interest', 'warning');
        return;
      }
    }

    if (step < totalSteps) {
      setStep((prev) => prev + 1);
    } else {
      finishOnboarding();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file (JPEG, PNG, WebP)', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo size must be less than 5MB', 'warning');
      return;
    }

    setSelectedFiles((prev) => [file, ...prev]);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotos([reader.result, ...photos]);
        showToast('Photo added', 'success');
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      if (interests.length < 6) {
        setInterests([...interests, interest]);
      }
    }
  };

  const finishOnboarding = async () => {
    if (!existingAuthUserId) return;
    setIsSubmitting(true);
    try {
      let uploadedPhotoUrls: string[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        try {
          const url = await profileService.uploadProfilePhoto(existingAuthUserId, selectedFiles[i], i);
          uploadedPhotoUrls.push(url);
        } catch (uploadErr) {
          console.warn('Photo upload warning:', uploadErr);
        }
      }

      if (uploadedPhotoUrls.length === 0 && photos.length > 0) {
        uploadedPhotoUrls = photos;
      }

      const finalPhotos = uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : photos;

      await supabase.from('arrow_profiles').upsert({
        id: existingAuthUserId,
        name: name.trim(),
        bio: bio.trim(),
        interests,
        looking_for: lookingFor,
        allow_whatsapp: Boolean(allowWhatsApp),
        whatsapp_number: allowWhatsApp ? whatsappNumber.trim() : null,
        updated_at: new Date().toISOString(),
      });

      const createdProfile: UserProfile = {
        id: existingAuthUserId,
        name: name.trim(),
        dateOfBirth,
        age: calculatedAge,
        gender,
        location: location.trim(),
        bio: bio.trim(),
        photos: finalPhotos,
        interests,
        lookingFor,
        prompts: [
          {
            id: 'p1',
            question: 'A perfect Sunday looks like...',
            answer: 'Exploring quiet coffee spots and listening to vinyl records.',
          },
        ],
        allowWhatsApp,
        whatsappNumber: allowWhatsApp ? whatsappNumber.trim() : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isVerifiedAdult: true,
      };

      onComplete(createdProfile);
    } catch (err: any) {
      showToast(err.message || 'Error creating profile', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 max-w-sm mx-auto w-full min-h-screen">
      {/* Top Brand & Progress */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="brand-wordmark text-lg">
            ARROW <span className="brand-arrow-glyph">→</span>
          </div>
          <span className="text-xs font-bold text-[#7A766E]">
            Step {step} of {totalSteps}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-[#EBE8E1] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#111111] transition-all duration-300 rounded-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Contents */}
      <div className="py-6 flex-1 flex flex-col justify-center">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#111111] tracking-tight">
                Create Your Profile
              </h2>
              <p className="text-xs text-[#7A766E]">
                Sign in with Google to get started.
              </p>
            </div>

            <div className="space-y-3.5">
              {/* Google Sign In */}
              {isSupabaseConfigured && (
                <div className="p-3 bg-white rounded-2xl border border-[#D9D6CF] space-y-2.5">
                  <div className="relative flex items-center gap-2">
                    <div className="flex-1 h-px bg-[#E2DDD5]" />
                    <span className="text-[10px] text-[#7A766E] font-semibold uppercase tracking-wider">Google</span>
                    <div className="flex-1 h-px bg-[#E2DDD5]" />
                  </div>

                  <Button
                    variant="outline"
                    fullWidth
                    onClick={handleGoogleSignUp}
                    disabled={isSubmitting || existingAuthUserId !== null}
                    icon={<Chrome size={16} />}
                  >
                    {existingAuthUserId ? `Google account connected (${authEmail})` : 'Continue with Google'}
                  </Button>

                  {existingAuthUserId && (
                    <p className="text-[10px] text-[#17352F] font-semibold">
                      Signed in as {authEmail}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#E2DDD5]" />
                <span className="text-[10px] text-[#7A766E] font-semibold uppercase tracking-wider">or Email</span>
                <div className="flex-1 h-px bg-[#E2DDD5]" />
              </div>

              {isSupabaseConfigured && (
                <form onSubmit={handleEmailSignUp} className="p-3 bg-white rounded-2xl border border-[#D9D6CF] space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#111111]">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#111111]">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111]"
                    />
                  </div>
                  <Button
                    variant="primary"
                    fullWidth
                    type="submit"
                    disabled={isSubmitting || existingAuthUserId !== null}
                  >
                    {existingAuthUserId ? 'Account connected' : 'Create Account'}
                  </Button>
                </form>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#111111]">
                  First & Last Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111]"
                />
              </div>

              {/* Gender */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#111111]">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['woman', 'man', 'non-binary'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold capitalize transition-colors ${
                        gender === g
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'bg-white text-[#111111] border-[#E2DDD5]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#111111]">
                  City / Location
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. London, UK"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111]"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#111111] tracking-tight">
                Verify Your Email
              </h2>
              <p className="text-xs text-[#7A766E]">
                Confirm your email address to continue.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#D9D6CF] space-y-3 shadow-xs">
              {isEmailVerified ? (
                <div className="flex items-center gap-2 text-xs text-[#17352F]">
                  <ShieldAlert size={16} />
                  <span className="font-bold">Email verified successfully</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#111111]">
                    Check your email inbox for a verification link from Supabase Auth.
                  </p>
                  <p className="text-[10px] text-[#7A766E]">
                    Sent to: {authEmail || 'your Google email'}
                  </p>
                  <div className="pt-2 space-y-2">
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={resendVerificationEmail}
                      disabled={isCheckingVerification}
                      icon={<RefreshCw size={14} />}
                    >
                      Resend Verification Email
                    </Button>
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={checkEmailVerificationStatus}
                      disabled={isCheckingVerification}
                    >
                      {isCheckingVerification ? 'Checking...' : "I've Verified My Email"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#111111] tracking-tight">
                Before you join Arrow
              </h2>
              <p className="text-xs text-[#7A766E]">
                Arrow is an 18+ dating app.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#D9D6CF] space-y-4 shadow-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#111111]">
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  max={new Date().toISOString().split('T')[0]}
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    setHasConfirmedAge(false);
                    setVerificationError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111]"
                />
                <div className="flex items-center gap-1 text-[10px] text-[#7A766E]">
                  <Lock size={11} className="text-[#17352F]" />
                  <span>Your birthdate is encrypted and never displayed publicly.</span>
                </div>
              </div>

              {dateOfBirth && (
                <div className="space-y-2">
                  <span
                    className={`text-[11px] font-bold ${
                      isEligibleAdult ? 'text-[#17352F]' : 'text-[#D9383A]'
                    }`}
                  >
                    {calculatedAge} yrs {isEligibleAdult ? '✓ (18+)' : '✗ (Must be 18+)'}
                  </span>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasConfirmedAge}
                      onChange={(e) => setHasConfirmedAge(e.target.checked)}
                      disabled={!isEligibleAdult}
                      className="mt-0.5 w-4 h-4 accent-[#17352F] cursor-pointer"
                    />
                    <span className="text-xs text-[#111111]">
                      I confirm that I am 18 years old or older.
                    </span>
                  </label>
                </div>
              )}

              {verificationError && (
                <p className="text-xs text-[#D9383A] font-medium">{verificationError}</p>
              )}

              <Button
                variant="primary"
                fullWidth
                onClick={handleNextStep}
                disabled={isVerifyingAge || !dateOfBirth || !isEligibleAdult || !hasConfirmedAge}
              >
                {isVerifyingAge ? 'Verifying...' : 'Verify Age & Continue'}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#111111] tracking-tight">
                Profile Photo
              </h2>
              <p className="text-xs text-[#7A766E]">
                Add a natural portrait that represents you well.
              </p>
            </div>

            {/* Photo Preview & Selection */}
            <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden bg-[#EBE8E1] border-2 border-[#111111] shadow-md">
              {photos[0] ? (
                <img
                  src={photos[0]}
                  alt="Selected preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#7A766E]">
                  <Camera size={32} className="mb-2 opacity-60" />
                  <span className="text-xs font-bold">No photo selected</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

              <div className="absolute bottom-4 inset-x-4 flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                />
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={handleCameraCapture}
                  icon={<Camera size={14} />}
                >
                  Take Photo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={handleFileSelect}
                  icon={<Upload size={14} />}
                >
                  Upload
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-[#7A766E] text-center">
              Take a selfie or upload a clear portrait. This helps ensure genuine profiles.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#111111] tracking-tight">
                Interests & Intent
              </h2>
              <p className="text-xs text-[#7A766E]">
                What are you curious about and seeking?
              </p>
            </div>

            {/* Looking For */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#111111]">
                What are you looking for?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {LOOKING_FOR_OPTIONS.map((opt) => (
                  <Badge
                    key={opt}
                    selected={lookingFor === opt}
                    onClick={() => setLookingFor(opt)}
                    size="sm"
                  >
                    {opt}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-[#111111]">
                <label>Select Your Passions</label>
                <span className="text-[10px] text-[#7A766E]">
                  {interests.length}/6
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_INTERESTS.map((interest) => (
                  <Badge
                    key={interest}
                    selected={interests.includes(interest)}
                    onClick={() => toggleInterest(interest)}
                    size="sm"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Short Bio */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#111111]">
                Short Bio (Optional)
              </label>
              <textarea
                rows={2}
                maxLength={200}
                placeholder="A couple sentences introducing yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111] resize-none"
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#111111] tracking-tight">
                Connection Method
              </h2>
              <p className="text-xs text-[#7A766E]">
                Choose how you want to continue after a mutual match.
              </p>
            </div>

            {/* WhatsApp Option */}
            <div className="p-4 bg-white rounded-2xl border border-[#E2DDD5] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#111111]">
                    Enable WhatsApp Connection
                  </h3>
                  <p className="text-[11px] text-[#7A766E]">
                    Direct connection button upon mutual match
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowWhatsApp}
                  onChange={(e) => setAllowWhatsApp(e.target.checked)}
                  className="w-5 h-5 accent-[#17352F] cursor-pointer"
                />
              </div>

              {allowWhatsApp && (
                <div className="space-y-1.5 pt-1 border-t border-[#EFECE6]">
                  <label className="text-xs font-bold text-[#111111]">
                    WhatsApp Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+44 7000 000000"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] text-xs text-[#111111] font-mono"
                  />
                  <p className="text-[10px] text-[#7A766E]">
                    Your number is never shown publicly in discovery cards.
                  </p>
                </div>
              )}
            </div>

            {/* Privacy Box */}
            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] text-xs space-y-1">
              <h4 className="font-bold text-[#111111]">ARROW Security Standard</h4>
              <p className="text-[#7A766E] leading-relaxed">
                By entering ARROW, you confirm you are 18+ and agree to respectful, genuine interactions backed by Row-Level Security.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-[#E2DDD5]">
        {step > 1 ? (
          <Button
            variant="ghost"
            onClick={() => setStep((prev) => prev - 1)}
            icon={<ChevronLeft size={16} />}
            disabled={isSubmitting}
          >
            Back
          </Button>
        ) : onCancel ? (
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        ) : null}

        <Button
          variant="primary"
          fullWidth
          onClick={handleNextStep}
          disabled={isSubmitting}
          arrow={step === totalSteps ? 'right' : 'right'}
        >
          {isSubmitting ? 'Creating Profile...' : step === totalSteps ? 'Enter ARROW' : 'Continue'}
        </Button>
      </div>
    </div>
  );
};
