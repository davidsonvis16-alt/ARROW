import React, { useState } from 'react';
import { FilterState, Gender } from '../../types';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { RotateCcw } from 'lucide-react';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (newFilters: FilterState) => void;
  onResetFilters: () => void;
}

const ALL_INTERESTS = [
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

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
}) => {
  const [ageMin, setAgeMin] = useState(filters.ageMin);
  const [ageMax, setAgeMax] = useState(filters.ageMax);
  const [genders, setGenders] = useState<Gender[]>(filters.genders);
  const [location, setLocation] = useState(filters.location);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(filters.interests);
  const [selectedLookingFor, setSelectedLookingFor] = useState<string[]>(filters.lookingFor);

  const toggleGender = (gender: Gender) => {
    if (gender === 'everyone') {
      setGenders(['everyone']);
      return;
    }
    const current = genders.filter((g) => g !== 'everyone');
    if (current.includes(gender)) {
      const next = current.filter((g) => g !== gender);
      setGenders(next.length === 0 ? ['everyone'] : next);
    } else {
      setGenders([...current, gender]);
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const toggleLookingFor = (opt: string) => {
    if (selectedLookingFor.includes(opt)) {
      setSelectedLookingFor(selectedLookingFor.filter((o) => o !== opt));
    } else {
      setSelectedLookingFor([...selectedLookingFor, opt]);
    }
  };

  const handleApply = () => {
    onApplyFilters({
      ageMin,
      ageMax,
      genders,
      location,
      interests: selectedInterests,
      lookingFor: selectedLookingFor,
    });
    onClose();
  };

  const handleReset = () => {
    setAgeMin(18);
    setAgeMax(60);
    setGenders(['everyone']);
    setLocation('');
    setSelectedInterests([]);
    setSelectedLookingFor([]);
    onResetFilters();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title="Discovery Preferences"
      subtitle="Refine profiles shown in your discover feed"
    >
      <div className="space-y-6 pb-2">
        {/* Age Range Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#111111]">
            <span>Age Range</span>
            <span className="text-[#E85D2A] font-extrabold">
              {ageMin} – {ageMax >= 65 ? '65+' : ageMax}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-[10px] text-[#7A766E] mb-1">
                <span>Minimum Age (18+)</span>
                <span>{ageMin}</span>
              </div>
              <input
                type="range"
                min="18"
                max="50"
                value={ageMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAgeMin(val);
                  if (val > ageMax) setAgeMax(val);
                }}
                className="w-full accent-[#E85D2A] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#7A766E] mb-1">
                <span>Maximum Age</span>
                <span>{ageMax >= 65 ? '65+' : ageMax}</span>
              </div>
              <input
                type="range"
                min="19"
                max="65"
                value={ageMax}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAgeMax(val);
                  if (val < ageMin) setAgeMin(val);
                }}
                className="w-full accent-[#E85D2A] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Gender Preference */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#111111]">Show Me</label>
          <div className="flex flex-wrap gap-2">
            {(['everyone', 'woman', 'man', 'non-binary'] as Gender[]).map((g) => (
              <Badge
                key={g}
                selected={genders.includes(g)}
                onClick={() => toggleGender(g)}
                size="md"
              >
                <span className="capitalize">{g === 'everyone' ? 'Everyone' : g}</span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#111111]">
            City / General Location
          </label>
          <input
            type="text"
            placeholder="e.g. Nairobi, London, Berlin"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] text-xs text-[#111111] focus:bg-white placeholder:text-[#7A766E]"
          />
        </div>

        {/* Looking For Filter */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#111111]">Looking For</label>
          <div className="flex flex-wrap gap-1.5">
            {LOOKING_FOR_OPTIONS.map((opt) => (
              <Badge
                key={opt}
                selected={selectedLookingFor.includes(opt)}
                onClick={() => toggleLookingFor(opt)}
                size="sm"
              >
                {opt}
              </Badge>
            ))}
          </div>
        </div>

        {/* Interests Filter */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#111111]">Interests</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_INTERESTS.map((interest) => (
              <Badge
                key={interest}
                selected={selectedInterests.includes(interest)}
                onClick={() => toggleInterest(interest)}
                size="sm"
              >
                {interest}
              </Badge>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-3 border-t border-[#E2DDD5]">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2.5 rounded-xl border border-[#D9D6CF] text-xs font-bold text-[#7A766E] hover:text-[#111111] hover:bg-[#EBE8E1] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <Button
            variant="primary"
            fullWidth
            onClick={handleApply}
            arrow="right"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </Modal>
  );
};
