import React from 'react';
import { UserProfile, MatchRecord } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { MessageCircle, Compass } from 'lucide-react';

interface MatchCelebrationModalProps {
  currentUser: UserProfile;
  matchedProfile: UserProfile | null;
  matchRecord?: MatchRecord;
  isOpen: boolean;
  onClose: () => void;
  onContinueDiscover: () => void;
}

export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  currentUser,
  matchedProfile,
  isOpen,
  onClose,
  onContinueDiscover,
}) => {
  if (!matchedProfile) return null;

  const currentPhoto = currentUser.photos[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  const matchedPhoto = matchedProfile.photos[0] || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80';

  const handleOpenWhatsApp = () => {
    if (!matchedProfile.whatsappNumber) {
      // Safe fallback if number not provided
      window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer');
      return;
    }
    // Format sanitized number for WhatsApp API
    const cleaned = matchedProfile.whatsappNumber.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hi ${matchedProfile.name}, we matched on ARROW! Great to connect.`
    );
    window.open(`https://wa.me/${cleaned}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="center"
      maxWidth="sm"
      showCloseButton={true}
    >
      <div className="text-center py-2 space-y-5">
        {/* Directional Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF1EB] text-[#E85D2A] text-xs font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2A]" />
            <span>Mutual Direction</span>
          </div>
          <h2 className="text-2xl font-black text-[#111111] tracking-tight">
            You're connected.
          </h2>
          <p className="text-xs text-[#7A766E]">
            You and <span className="font-semibold text-[#111111]">{matchedProfile.name}</span> expressed mutual interest.
          </p>
        </div>

        {/* Dual Avatars with Arrow */}
        <div className="flex items-center justify-center gap-3 py-3">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#111111] shadow-md">
            <img
              src={currentPhoto}
              alt={currentUser.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[#E85D2A] font-black text-2xl animate-pulse">
              →
            </span>
          </div>

          <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#E85D2A] shadow-md">
            <img
              src={matchedPhoto}
              alt={matchedProfile.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* WhatsApp Connection Action or Notice */}
        <div className="space-y-3 pt-2">
          {matchedProfile.allowWhatsApp && (
            <div className="space-y-2">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={handleOpenWhatsApp}
                icon={<MessageCircle size={18} className="text-[#25D366]" />}
                arrow="up-right"
              >
                Continue to WhatsApp
              </Button>
              <p className="text-[11px] text-[#7A766E] leading-tight">
                Secure connection via WhatsApp. Phone numbers are never exposed publicly on profiles.
              </p>
            </div>
          )}

          {!matchedProfile.allowWhatsApp && (
            <div className="p-3 bg-[#FAF8F4] rounded-xl border border-[#E2DDD5] text-xs text-[#7A766E]">
              {matchedProfile.name} will appear in your Matches list.
            </div>
          )}

          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              onClose();
              onContinueDiscover();
            }}
            icon={<Compass size={16} />}
          >
            Keep Exploring
          </Button>
        </div>
      </div>
    </Modal>
  );
};
