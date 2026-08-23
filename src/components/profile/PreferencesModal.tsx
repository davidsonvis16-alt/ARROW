import React, { useState } from 'react';
import { DatingPreferences, Gender } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';

interface PreferencesModalProps {
  preferences: DatingPreferences;
  isOpen: boolean;
  onClose: () => void;
  onSave: (prefs: DatingPreferences) => Promise<void>;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  preferences,
  isOpen,
  onClose,
  onSave,
}) => {
  const [ageMin, setAgeMin] = useState(preferences.ageMin || 18);
  const [ageMax, setAgeMax] = useState(preferences.ageMax || 45);
  const [genderPreference, setGenderPreference] = useState<Gender[]>(
    preferences.genderPreference || ['everyone']
  );
  const [locationPreference, setLocationPreference] = useState(
    preferences.locationPreference || ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const toggleGender = (g: Gender) => {
    if (g === 'everyone') {
      setGenderPreference(['everyone']);
      return;
    }
    const filtered = genderPreference.filter((x) => x !== 'everyone');
    if (filtered.includes(g)) {
      const next = filtered.filter((x) => x !== g);
      setGenderPreference(next.length === 0 ? ['everyone'] : next);
    } else {
      setGenderPreference([...filtered, g]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...preferences,
        ageMin,
        ageMax,
        genderPreference,
        locationPreference: locationPreference.trim(),
      });
      showToast('Dating preferences updated', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to update preferences', 'error');
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
      title="Dating Preferences"
      subtitle="Control who you meet on ARROW"
    >
      <div className="space-y-6 pb-4">
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
                selected={genderPreference.includes(g)}
                onClick={() => toggleGender(g)}
                size="md"
              >
                <span className="capitalize">{g === 'everyone' ? 'Everyone' : g}</span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Location Target */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#111111]">
            Preferred City / Area (Optional)
          </label>
          <input
            type="text"
            placeholder="Leave empty for all areas"
            value={locationPreference}
            onChange={(e) => setLocationPreference(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-[#FFFFFF] text-xs text-[#111111]"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-3 border-t border-[#E2DDD5]">
          <Button
            variant="ghost"
            fullWidth
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={handleSave}
            disabled={isSaving}
            arrow="right"
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
