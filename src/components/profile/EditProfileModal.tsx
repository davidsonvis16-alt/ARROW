import React, { useState } from 'react';
import { UserProfile, PromptItem } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useSecure } from '../secure/SecureChat';
import { Lock, Plus, Trash2 } from 'lucide-react';

interface EditProfileModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<UserProfile>) => Promise<void>;
}

const AVAILABLE_PROMPT_QUESTIONS = [
  'A perfect Sunday looks like...',
  'What is something you are currently obsessed with?',
  'Your ideal first date?',
  'The best piece of advice I ever received...',
  'Together, we could...',
  'My most unconventional opinion is...',
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
  'Tech',
  'Yoga',
  'Faith & church',
  'Family time',
  'Gardening',
  'Dancing',
  'Football',
  'Farming',
  'Volunteering',
  'Board games',
];

/** Starting points for "ask me first". People can write their own. */
const ASK_FIRST_IDEAS = [
  'What does a good Sunday look like for you?',
  'What are you looking for at this point in your life?',
  'How do you show someone you care?',
  'What is something you are proud of?',
  'Where would you take me on a first date?',
  'What role does faith or family play in your life?',
];
const MAX_ASK_FIRST = 3;

const LOOKING_FOR_OPTIONS = [
  'Long-term connection',
  'Marriage',
  'Meaningful dating',
  'Companionship',
  'Friendship first',
  'Casual & open',
  'Deep conversations',
  'Activity partner',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [location, setLocation] = useState(currentUser.location);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [lookingFor, setLookingFor] = useState(currentUser.lookingFor || '');
  const [interests, setInterests] = useState<string[]>(currentUser.interests || []);
  const [prompts, setPrompts] = useState<PromptItem[]>(currentUser.prompts || []);
  const [askFirst, setAskFirst] = useState<string[]>(currentUser.askFirst || []);
  const [isSaving, setIsSaving] = useState(false);
  const { status: secureStatus, requireSecure } = useSecure();
  const askFirstAvailable = secureStatus !== 'unavailable';

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      if (interests.length < 8) {
        setInterests([...interests, interest]);
      }
    }
  };

  const addPrompt = () => {
    if (prompts.length >= 3) return;
    const unusedQuestions = AVAILABLE_PROMPT_QUESTIONS.filter(
      (q) => !prompts.some((p) => p.question === q)
    );
    const newQuestion = unusedQuestions[0] || AVAILABLE_PROMPT_QUESTIONS[0];
    setPrompts([
      ...prompts,
      {
        id: `prompt_${Date.now()}`,
        question: newQuestion,
        answer: '',
      },
    ]);
  };

  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const updatePrompt = (index: number, question: string, answer: string) => {
    const updated = [...prompts];
    updated[index] = { ...updated[index], question, answer };
    setPrompts(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const questions = askFirst.map((q) => q.trim()).filter((q) => q.length >= 3);
    // Answers are encrypted to you, so you need a key before anyone can answer.
    if (questions.length && !(await requireSecure('Answers to your questions are encrypted so only you can read them.'))) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
        lookingFor,
        interests,
        prompts: prompts.filter((p) => p.answer.trim() !== ''),
        ...(askFirstAvailable ? { askFirst: questions } : {}),
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title="Edit Profile"
      subtitle="Update how you appear on Finderr"
    >
      <form onSubmit={handleSave} className="space-y-6 pb-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--color-ink)]">Full Name</label>
          <input
            type="text"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-xs text-[var(--color-ink)]"
          />
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--color-ink)]">
            City / General Location
          </label>
          <input
            type="text"
            required
            maxLength={60}
            placeholder="e.g. Nairobi, Kenya"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-xs text-[var(--color-ink)]"
          />
          <p className="text-[10px] text-[var(--color-stone-dark)]">
            General location only. Specific addresses are never stored or requested.
          </p>
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-[var(--color-ink)]">
            <label>Short Bio</label>
            <span className="text-[10px] text-[var(--color-stone-dark)] font-normal">
              {bio.length}/300
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={300}
            placeholder="A few words about your mindset, passions, or current focus..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-xs text-[var(--color-ink)] leading-relaxed resize-none"
          />
        </div>

        {/* Looking For */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[var(--color-ink)]">Looking For</label>
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
          <div className="flex justify-between items-center text-xs font-bold text-[var(--color-ink)]">
            <label>Interests & Passions</label>
            <span className="text-[10px] text-[var(--color-stone-dark)] font-normal">
              {interests.length}/8 selected
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

        {/* Prompts Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-[var(--color-ink)]">
                Profile Prompts (Up to 3)
              </h4>
              <p className="text-[10px] text-[var(--color-stone-dark)]">
                Add personality to your profile
              </p>
            </div>
            {prompts.length < 3 && (
              <button
                type="button"
                onClick={addPrompt}
                className="text-xs font-bold text-[var(--color-arrow-orange-text)] flex items-center gap-1 hover:underline"
              >
                <Plus size={13} />
                <span>Add Prompt</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {prompts.map((prompt, idx) => (
              <div
                key={prompt.id || idx}
                className="p-3.5 bg-[var(--color-surface-subtle)] rounded-2xl border border-[var(--color-border-subtle)] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center flex-1">
                    <select
                      value={prompt.question}
                      onChange={(e) =>
                        updatePrompt(idx, e.target.value, prompt.answer)
                      }
                      className="w-full text-xs font-bold text-[var(--color-ink)] bg-transparent border-none focus:outline-none cursor-pointer"
                    >
                      {AVAILABLE_PROMPT_QUESTIONS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePrompt(idx)}
                    className="p-1 text-[var(--color-stone-dark)] hover:text-[var(--color-danger-text)] transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <input
                  type="text"
                  maxLength={160}
                  placeholder="Your answer..."
                  value={prompt.answer}
                  onChange={(e) =>
                    updatePrompt(idx, prompt.question, e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-ink)]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Ask me first */}
        {askFirstAvailable && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-[var(--color-ink)]">Ask me first (up to {MAX_ASK_FIRST})</h4>
                <p className="text-[10px] text-[var(--color-stone-dark)]">
                  Anyone who sends you a spark answers these first
                </p>
              </div>
              {askFirst.length < MAX_ASK_FIRST && (
                <button
                  type="button"
                  onClick={() => setAskFirst([...askFirst, ''])}
                  className="text-xs font-bold text-[var(--color-arrow-orange-text)] flex items-center gap-1 hover:underline"
                >
                  <Plus size={13} />
                  <span>Add question</span>
                </button>
              )}
            </div>

            {askFirst.map((question, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Write a question…"
                  value={question}
                  onChange={(e) => setAskFirst(askFirst.map((q, i) => (i === idx ? e.target.value : q)))}
                  className="flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-ink)]"
                />
                <button
                  type="button"
                  onClick={() => setAskFirst(askFirst.filter((_, i) => i !== idx))}
                  className="p-1 text-[var(--color-stone-dark)] hover:text-[var(--color-danger-text)] transition-colors"
                  aria-label="Remove question"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {askFirst.length < MAX_ASK_FIRST && (
              <div className="flex flex-wrap gap-1.5">
                {ASK_FIRST_IDEAS.filter((idea) => !askFirst.includes(idea)).map((idea) => (
                  <Badge key={idea} size="sm" onClick={() => setAskFirst([...askFirst.filter((q) => q.trim()), idea])}>
                    {idea}
                  </Badge>
                ))}
              </div>
            )}

            <p className="flex items-start gap-1.5 text-[10px] text-[var(--color-stone-dark)] leading-relaxed">
              <Lock size={11} className="shrink-0 mt-px text-[var(--color-forest)]" />
              Your questions are public. The answers are end-to-end encrypted, so only you can read them.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isSaving}
            arrow="right"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
