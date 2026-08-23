import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { MessageCircle, ShieldCheck, Lock } from 'lucide-react';

interface WhatsAppModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (allowWhatsApp: boolean, whatsappNumber: string) => Promise<void>;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSave,
}) => {
  const [allowWhatsApp, setAllowWhatsApp] = useState(currentUser.allowWhatsApp || false);
  const [whatsappNumber, setWhatsappNumber] = useState(currentUser.whatsappNumber || '');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allowWhatsApp && !whatsappNumber.trim()) {
      showToast('Please enter your WhatsApp number or turn off connection', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(allowWhatsApp, whatsappNumber.trim());
      showToast('WhatsApp connection settings saved', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to save settings', 'error');
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
      title="WhatsApp Direct Connection"
      subtitle="Connect directly with mutual matches"
    >
      <form onSubmit={handleSave} className="space-y-6 pb-4">
        {/* Toggle Box */}
        <div className="p-4 bg-[#FFFFFF] rounded-2xl border border-[#E2DDD5] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#EAF1EF] border border-[#C5DCD6] text-[#17352F]">
              <MessageCircle size={18} className="text-[#25D366]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#111111]">
                Allow WhatsApp Connections
              </p>
              <p className="text-[11px] text-[#7A766E]">
                Enables a "Continue to WhatsApp" button for mutual matches
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={allowWhatsApp}
              onChange={(e) => setAllowWhatsApp(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#D9D6CF] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#17352F]" />
          </label>
        </div>

        {/* Number Input (if enabled) */}
        {allowWhatsApp && (
          <div className="space-y-1.5 animate-in fade-in duration-200">
            <label className="text-xs font-bold text-[#111111]">
              WhatsApp Phone Number (with Country Code)
            </label>
            <input
              type="tel"
              required={allowWhatsApp}
              placeholder="+254 700 000 000 or +1 415 555 0199"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-[#FFFFFF] text-xs text-[#111111] font-mono placeholder:font-sans placeholder:text-[#7A766E]"
            />
            <p className="text-[10px] text-[#7A766E]">
              Include international country code prefix (+).
            </p>
          </div>
        )}

        {/* Privacy & Safety Guarantee */}
        <div className="p-4 bg-[#F4F8F7] rounded-2xl border border-[#C5DCD6] space-y-2 text-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-[#17352F]">
            <Lock size={14} className="text-[#17352F]" />
            <span>Strict Privacy Architecture</span>
          </div>
          <ul className="text-[11px] text-[#333333] space-y-1 leading-relaxed">
            <li className="flex items-start gap-1.5">
              <span className="text-[#E85D2A] font-bold">→</span>
              <span>Your number is <strong>never displayed</strong> on Discover, public profiles, or search.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#E85D2A] font-bold">→</span>
              <span>Connections only activate when both users like each other.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#E85D2A] font-bold">→</span>
              <span>You can revoke permission or disable WhatsApp anytime.</span>
            </li>
          </ul>
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
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
