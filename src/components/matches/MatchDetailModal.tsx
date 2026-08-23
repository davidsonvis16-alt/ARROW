import React, { useState } from 'react';
import { UserProfile, MatchRecord } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { api } from '../../services/api';
import { useToast } from '../ui/Toast';
import { MessageCircle, MapPin, UserX, ShieldAlert, Lock } from 'lucide-react';

interface MatchDetailModalProps {
  matchItem: (MatchRecord & { partnerProfile: UserProfile }) | null;
  isOpen: boolean;
  onClose: () => void;
  onUnmatch: (matchId: string, partnerName: string) => void;
  onReport: (profile: UserProfile) => void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  matchItem,
  isOpen,
  onClose,
  onUnmatch,
  onReport,
}) => {
  const { showToast } = useToast();
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);

  if (!matchItem) return null;

  const profile = matchItem.partnerProfile;
  const photo = profile.photos[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';

  const handleOpenWhatsApp = async () => {
    setLoadingWhatsApp(true);
    try {
      // Securely fetch partner contact number through authenticated Postgres RPC
      const contactData = await api.getMatchWhatsApp(matchItem.id);

      if (contactData.allowWhatsApp && contactData.whatsappNumber) {
        const cleaned = contactData.whatsappNumber.replace(/[^0-9]/g, '');
        const text = encodeURIComponent(
          `Hi ${profile.name}, we matched on ARROW! Great to connect.`
        );
        window.open(`https://wa.me/${cleaned}?text=${text}`, '_blank', 'noopener,noreferrer');
      } else {
        showToast(`${profile.name} has not shared a WhatsApp contact number.`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not retrieve WhatsApp connection details.', 'error');
    } finally {
      setLoadingWhatsApp(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title="Connected Profile"
    >
      <div className="space-y-5 pb-2">
        {/* Top Visual */}
        <div className="relative aspect-[16/11] rounded-2xl overflow-hidden bg-[#EBE8E1] border border-[#E2DDD5]">
          <img
            src={photo}
            alt={profile.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          <div className="absolute bottom-3 inset-x-4 text-white">
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-black">{profile.name}</h2>
              <span className="text-xl font-normal text-white/90">
                {profile.age}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-white/85">
              <MapPin size={12} className="text-[#E85D2A]" />
              <span>{profile.location}</span>
            </div>
          </div>
        </div>

        {/* Mutual Connection Badge */}
        <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#E85D2A] font-black text-sm">→</span>
            <div>
              <p className="text-xs font-bold text-[#111111]">
                Mutual Match on ARROW
              </p>
              <p className="text-[11px] text-[#7A766E]">
                Connected on {new Date(matchItem.matchedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp Connection Action */}
        <div className="space-y-2">
          {profile.allowWhatsApp ? (
            <div className="p-4 bg-[#F4F8F7] rounded-2xl border border-[#C5DCD6] space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle size={20} className="text-[#25D366]" />
                <div>
                  <h4 className="text-xs font-bold text-[#17352F]">
                    WhatsApp Connection Authorized
                  </h4>
                  <p className="text-[11px] text-[#7A766E]">
                    {profile.name} has enabled direct WhatsApp messaging.
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                fullWidth
                size="md"
                onClick={handleOpenWhatsApp}
                disabled={loadingWhatsApp}
                icon={<MessageCircle size={16} className="text-[#25D366]" />}
                arrow="up-right"
              >
                {loadingWhatsApp ? 'Connecting...' : 'Continue to WhatsApp'}
              </Button>

              <div className="flex items-center justify-center gap-1 text-[10px] text-[#7A766E]">
                <Lock size={11} className="text-[#17352F]" />
                <span>Contact numbers are protected and only decrypted upon mutual match.</span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-[#FAF8F4] rounded-xl border border-[#E2DDD5] text-xs text-[#7A766E]">
              {profile.name} has not enabled external WhatsApp connections yet.
            </div>
          )}
        </div>

        {/* Bio & Details */}
        {profile.bio && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E]">
              About {profile.name}
            </h4>
            <p className="text-xs text-[#222222] leading-relaxed whitespace-pre-line">
              {profile.bio}
            </p>
          </div>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766E]">
              Shared Interests
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((interest, i) => (
                <Badge key={i} variant="neutral" size="sm">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Prompts */}
        {profile.prompts && profile.prompts.length > 0 && (
          <div className="space-y-2">
            {profile.prompts.map(
              (p, idx) =>
                p.answer && (
                  <div
                    key={idx}
                    className="p-3 bg-[#FAF8F4] rounded-xl border border-[#E2DDD5] space-y-1"
                  >
                    <div className="text-[11px] font-bold text-[#17352F]">
                      <span>{p.question}</span>
                    </div>
                    <p className="text-xs text-[#222222] italic">"{p.answer}"</p>
                  </div>
                )
            )}
          </div>
        )}

        {/* Safety Actions: Unmatch / Report */}
        <div className="pt-3 border-t border-[#E2DDD5] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onUnmatch(matchItem.id, profile.name);
              onClose();
            }}
            className="flex-1 py-2 px-3 rounded-xl border border-[#D9D6CF] text-xs font-bold text-[#7A766E] hover:text-[#D9383A] hover:bg-[#FDF0F0] hover:border-[#F9C3AF] transition-colors flex items-center justify-center gap-1.5"
          >
            <UserX size={14} />
            <span>Unmatch</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onReport(profile);
              onClose();
            }}
            className="flex-1 py-2 px-3 rounded-xl border border-[#D9D6CF] text-xs font-bold text-[#7A766E] hover:text-[#D9383A] hover:bg-[#FDF0F0] hover:border-[#F9C3AF] transition-colors flex items-center justify-center gap-1.5"
          >
            <ShieldAlert size={14} />
            <span>Report / Block</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
