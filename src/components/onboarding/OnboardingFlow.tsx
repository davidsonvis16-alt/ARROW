import React, { useState, useRef } from 'react';
import { UserProfile, Gender } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { calculateAge, isAdult } from '../../services/storageService';
import { isSupabaseConfigured } from '../../lib/supabase';
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
  Mail,
  Key,
} from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: (profile: UserProfile) => void;
  onCancel?: () => void;
}

const SAMPLE_PHOTO_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
];

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
  const totalSteps = 4;
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Credentials (when Supabase is configured)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 1: Basic Identity & 18+ Age verification
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'woman' | 'man' | 'non-binary'>('woman');
  const [location, setLocation] = useState('');

  // Step 2: Photos
  const [photos, setPhotos] = useState<string[]>([SAMPLE_PHOTO_PRESETS[0]]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Bio, Looking for & Interests
  const [bio, setBio] = useState('');
  const [lookingFor, setLookingFor] = useState('Meaningful dating');
  const [interests, setInterests] = useState<string[]>(['Architecture', 'Coffee']);

  // Step 4: WhatsApp Option & Completion
  const [allowWhatsApp, setAllowWhatsApp] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Age calculation
  const calculatedAge = dateOfBirth ? calculateAge(dateOfBirth) : 0;
  const isEligibleAdult = isAdult(dateOfBirth);

  const handleNextStep = () => {
    if (step === 1) {
      if (isSupabaseConfigured) {
        if (!email.trim() || !password.trim()) {
          showToast('Please provide an email and password to secure your profile', 'warning');
          return;
        }
        if (password.length < 6) {
          showToast('Password must be at least 6 characters', 'warning');
          return;
        }
      }
      if (!name.trim()) {
        showToast('Please enter your name', 'warning');
        return;
      }
      if (!dateOfBirth) {
        showToast('Please enter your date of birth', 'warning');
        return;
      }
      if (!isEligibleAdult) {
        showToast('ARROW is strictly for verified adults aged 18 and older', 'error');
        return;
      }
      if (!location.trim()) {
        showToast('Please enter your general city or location', 'warning');
        return;
      }
    }

    if (step === 2) {
      if (photos.length === 0) {
        showToast('Please add at least one portrait photo', 'warning');
        return;
      }
    }

    if (step === 3) {
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
        setPhotos([reader.result, ...photos.filter((p) => !SAMPLE_PHOTO_PRESETS.includes(p))]);
        showToast('Photo added', 'success');
      }
    };
    reader.readAsDataURL(file);
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
    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured && email && password) {
        // Sign up through Supabase Auth
        const { user } = await authService.signUp({
          email: email.trim(),
          password,
          name: name.trim(),
          dateOfBirth,
          gender,
          location: location.trim(),
          bio: bio.trim(),
          interests,
          lookingFor,
          allowWhatsApp,
          whatsappNumber: allowWhatsApp ? whatsappNumber.trim() : undefined,
        });

        if (user) {
          // Upload any selected photos to Supabase Storage
          let uploadedPhotoUrls: string[] = [];
          for (let i = 0; i < selectedFiles.length; i++) {
            try {
              const url = await profileService.uploadProfilePhoto(user.id, selectedFiles[i], i);
              uploadedPhotoUrls.push(url);
            } catch (uploadErr) {
              console.warn('Photo upload warning:', uploadErr);
            }
          }

          if (uploadedPhotoUrls.length === 0 && photos.length > 0) {
            uploadedPhotoUrls = photos;
          }

          const createdProfile: UserProfile = {
            id: user.id,
            name: name.trim(),
            dateOfBirth,
            age: calculatedAge,
            gender,
            location: location.trim(),
            bio: bio.trim(),
            photos: uploadedPhotoUrls,
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
          return;
        }
      }

      // Local / Offline mode profile creation
      const localId = crypto.randomUUID
        ? crypto.randomUUID()
        : `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const newProfile: UserProfile = {
        id: localId,
        name: name.trim(),
        dateOfBirth,
        age: calculatedAge,
        gender,
        location: location.trim(),
        bio: bio.trim(),
        photos,
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

      onComplete(newProfile);
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
                Adult verification (18+) ensures a safe, genuine dating community.
              </p>
            </div>

            <div className="space-y-3.5">
              {/* If Supabase is active, prompt for email/password credentials */}
              {isSupabaseConfigured && (
                <div className="p-3 bg-white rounded-2xl border border-[#D9D6CF] space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                      <Mail size={13} className="text-[#7A766E]" />
                      <span>Email Address</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] text-xs text-[#111111]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                      <Key size={13} className="text-[#7A766E]" />
                      <span>Password (min 6 characters)</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] text-xs text-[#111111]"
                    />
                  </div>
                </div>
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

              {/* Date of Birth & Age Check */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-[#111111]">
                  <label>Date of Birth</label>
                  {dateOfBirth && (
                    <span
                      className={`text-[11px] font-bold ${
                        isEligibleAdult ? 'text-[#17352F]' : 'text-[#D9383A]'
                      }`}
                    >
                      {calculatedAge} yrs {isEligibleAdult ? '✓ (18+)' : '✗ (Must be 18+)'}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  required
                  max={new Date().toISOString().split('T')[0]}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111]"
                />
                <div className="flex items-center gap-1 text-[10px] text-[#7A766E]">
                  <Lock size={11} className="text-[#17352F]" />
                  <span>Your birthdate is encrypted and never displayed publicly.</span>
                </div>
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
                Profile Photo
              </h2>
              <p className="text-xs text-[#7A766E]">
                Add a natural portrait that represents you well.
              </p>
            </div>

            {/* Photo Preview & Selection */}
            <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden bg-[#EBE8E1] border-2 border-[#111111] shadow-md">
              <img
                src={photos[0]}
                alt="Selected preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

              <div className="absolute bottom-4 inset-x-4 flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Upload size={14} />}
                >
                  Upload Your Photo
                </Button>
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[#7A766E]">
                Or select a test portrait:
              </span>
              <div className="flex gap-2">
                {SAMPLE_PHOTO_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPhotos([preset])}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      photos[0] === preset
                        ? 'border-[#E85D2A] scale-105'
                        : 'border-[#E2DDD5] opacity-70'
                    }`}
                  >
                    <img
                      src={preset}
                      alt={`Preset ${idx + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
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

        {step === 4 && (
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
