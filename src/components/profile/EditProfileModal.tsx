import React, { useState } from 'react';
import { UserProfile, PromptItem } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Plus, Trash2 } from 'lucide-react';

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
];

const LOOKING_FOR_OPTIONS = [
  'Long-term connection',
  'Meaningful dating',
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
  const [isSaving, setIsSaving] = useState(false);

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
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
        lookingFor,
        interests,
        prompts: prompts.filter((p) => p.answer.trim() !== ''),
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
      subtitle="Update how you appear on ARROW"
    >
      <form onSubmit={handleSave} className="space-y-6 pb-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#111111]">Full Name</label>
          <input
            type="text"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-[#FFFFFF] text-xs text-[#111111]"
          />
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#111111]">
            City / General Location
          </label>
          <input
            type="text"
            required
            maxLength={60}
            placeholder="e.g. Nairobi, Kenya"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-[#FFFFFF] text-xs text-[#111111]"
          />
          <p className="text-[10px] text-[#7A766E]">
            General location only. Specific addresses are never stored or requested.
          </p>
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-[#111111]">
            <label>Short Bio</label>
            <span className="text-[10px] text-[#7A766E] font-normal">
              {bio.length}/300
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={300}
            placeholder="A few words about your mindset, passions, or current focus..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-[#FFFFFF] text-xs text-[#111111] leading-relaxed resize-none"
          />
        </div>

        {/* Looking For */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#111111]">Looking For</label>
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
            <label>Interests & Passions</label>
            <span className="text-[10px] text-[#7A766E] font-normal">
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
              <h4 className="text-xs font-bold text-[#111111]">
                Profile Prompts (Up to 3)
              </h4>
              <p className="text-[10px] text-[#7A766E]">
                Add personality to your profile
              </p>
            </div>
            {prompts.length < 3 && (
              <button
                type="button"
                onClick={addPrompt}
                className="text-xs font-bold text-[#E85D2A] flex items-center gap-1 hover:underline"
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
                className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center flex-1">
                    <select
                      value={prompt.question}
                      onChange={(e) =>
                        updatePrompt(idx, e.target.value, prompt.answer)
                      }
                      className="w-full text-xs font-bold text-[#111111] bg-transparent border-none focus:outline-none cursor-pointer"
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
                    className="p-1 text-[#7A766E] hover:text-[#D9383A] transition-colors"
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
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2DDD5] text-xs text-[#111111]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-3 border-t border-[#E2DDD5]">
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
