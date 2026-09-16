import React from 'react';
import { UserProfile, MatchRecord } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { MessageCircle, Compass } from 'lucide-react';

interface MatchCelebrationModalProps {
  currentUser: UserProfile;
  matchedProfile: UserProfile | null;
  matchRecord?: MatchRecord;
  isOpen: boolean;
  onClose: () => void;
  onContinueDiscover: () => void;
  onOpenConversation?: () => void;
}

export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  currentUser,
  matchedProfile,
  isOpen,
  onClose,
  onContinueDiscover,
  onOpenConversation,
}) => {
  if (!matchedProfile) return null;

  const currentPhoto = currentUser.photos[0];
  const matchedPhoto = matchedProfile.photos[0];

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
          <Avatar
            name={currentUser.name}
            src={currentPhoto}
            size="lg"
            className="border-2 border-[var(--color-ink)] shadow-md"
          />

          <div className="flex flex-col items-center">
            <span className="text-[#E85D2A] font-black text-2xl animate-pulse">
              →
            </span>
          </div>

          <Avatar
            name={matchedProfile.name}
            src={matchedPhoto}
            size="lg"
            className="border-2 border-[var(--color-arrow-orange)] shadow-md"
          />
        </div>

        {/* The next step is a message, not a phone number. */}
        <div className="space-y-3 pt-2">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={() => {
              onClose();
              onOpenConversation?.();
            }}
            icon={<MessageCircle size={18} />}
            arrow="right"
          >
            Send {matchedProfile.name} a message
          </Button>

          <p className="text-[11px] text-[var(--color-stone-dark)] leading-relaxed">
            {matchedProfile.allowWhatsApp
              ? `${matchedProfile.name} is also open to WhatsApp. You can move there from the conversation whenever you both want to.`
              : `${matchedProfile.name} is now in your matches.`}
          </p>

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
