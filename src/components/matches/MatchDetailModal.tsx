import React, { useState } from 'react';
import { UserProfile, MatchWithProfile } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ChatPanel } from '../chat/ChatPanel';
import { api } from '../../services/api';
import { useToast } from '../ui/Toast';
import { MessageCircle, MapPin, UserX, ShieldAlert, Lock, User } from 'lucide-react';

interface MatchDetailModalProps {
  matchItem: MatchWithProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onUnmatch: (matchId: string, partnerName: string) => void;
  onReport: (profile: UserProfile) => void;
  onConversationRead?: () => void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  matchItem,
  isOpen,
  onClose,
  onUnmatch,
  onReport,
  onConversationRead,
}) => {
  const { showToast } = useToast();
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [tab, setTab] = useState<'chat' | 'profile'>('chat');

  if (!matchItem) return null;

  const profile = matchItem.partnerProfile;
  const photo = profile.photos[0];

  const handleOpenWhatsApp = async () => {
    setLoadingWhatsApp(true);
    try {
      const contact = await api.getMatchWhatsApp(matchItem.id);

      if (contact.allowWhatsApp && contact.whatsappNumber) {
        const cleaned = contact.whatsappNumber.replace(/[^0-9]/g, '');
        const text = encodeURIComponent(`Hi ${profile.name}, we matched on ARROW.`);
        window.open(`https://wa.me/${cleaned}?text=${text}`, '_blank', 'noopener,noreferrer');
      } else {
        showToast(`${profile.name} has not shared a WhatsApp number.`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not open that conversation.', 'error');
    } finally {
      setLoadingWhatsApp(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="bottomSheet" maxWidth="md" title={profile.name}>
      <div className="space-y-4 pb-2">
        {/* Identity strip. Compact, because the conversation is the point of
            this screen — the full profile is one tap away. */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[var(--color-stone-light)] border border-[var(--color-border-subtle)] shrink-0 flex items-center justify-center">
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-xl font-black text-[var(--color-stone-dark)]">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-black text-[var(--color-ink)] truncate">{profile.name}</h2>
              {profile.age ? (
                <span className="text-sm text-[var(--color-stone-dark)]">{profile.age}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--color-stone-dark)]">
              {profile.location && (
                <>
                  <MapPin size={11} className="text-[var(--color-arrow-orange)]" />
                  <span className="truncate">{profile.location}</span>
                </>
              )}
              <span className="mx-1">·</span>
              <span>Matched {new Date(matchItem.matchedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div
          className="flex p-1 bg-[var(--color-surface-subtle)] rounded-[var(--radius-input)] border border-[var(--color-border-subtle)]"
          role="tablist"
        >
          {(['chat', 'profile'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`flex-1 py-2 rounded-[10px] text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                tab === value
                  ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-subtle)]'
                  : 'text-[var(--color-stone-dark)] hover:text-[var(--color-ink)]'
              }`}
            >
              {value === 'chat' ? <MessageCircle size={13} /> : <User size={13} />}
              {value === 'chat' ? 'Message' : 'Profile'}
            </button>
          ))}
        </div>

        {tab === 'chat' ? (
          <div className="space-y-3">
            <ChatPanel match={matchItem} onMessageSent={onConversationRead} />

            {profile.allowWhatsApp ? (
              <div className="p-3 bg-[var(--color-surface-subtle)] rounded-[var(--radius-card-sm)] border border-[var(--color-border-subtle)] space-y-2">
                <p className="text-[11px] text-[var(--color-stone-dark)] leading-relaxed">
                  {profile.name} is also open to WhatsApp. Moving off ARROW means sharing a
                  phone number, so it is worth talking here first.
                </p>
                <Button
                  variant="secondary"
                  fullWidth
                  size="sm"
                  onClick={handleOpenWhatsApp}
                  disabled={loadingWhatsApp}
                  icon={<MessageCircle size={14} className="text-[#25D366]" />}
                >
                  {loadingWhatsApp ? 'Opening...' : 'Continue on WhatsApp'}
                </Button>
                <div className="flex items-start gap-1.5 text-[10px] text-[var(--color-stone-dark)]">
                  <Lock size={11} className="shrink-0 mt-px text-[var(--color-forest)]" />
                  <span>
                    Numbers are released only to a confirmed match whose owner opted in, and
                    stop being shared the moment they turn it off.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {photo && (
              <div className="relative aspect-[16/11] rounded-[var(--radius-card-sm)] overflow-hidden bg-[var(--color-stone-light)] border border-[var(--color-border-subtle)]">
                <img src={photo} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}

            {profile.bio && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">
                  About {profile.name}
                </h4>
                <p className="text-xs text-[var(--color-ink)] leading-relaxed whitespace-pre-line">
                  {profile.bio}
                </p>
              </div>
            )}

            {profile.interests?.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">
                  Interests
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((interest) => (
                    <Badge key={interest} variant="neutral" size="sm">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.prompts?.length > 0 && (
              <div className="space-y-2">
                {profile.prompts.map(
                  (prompt) =>
                    prompt.answer && (
                      <div
                        key={prompt.id}
                        className="p-3 bg-[var(--color-surface-subtle)] rounded-[var(--radius-input)] border border-[var(--color-border-subtle)] space-y-1"
                      >
                        <div className="text-[11px] font-bold text-[var(--color-forest)]">
                          {prompt.question}
                        </div>
                        <p className="text-xs text-[var(--color-ink)] italic">{prompt.answer}</p>
                      </div>
                    )
                )}
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onUnmatch(matchItem.id, profile.name)}
            className="flex-1 py-2 px-3 rounded-[var(--radius-input)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-stone-dark)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-colors flex items-center justify-center gap-1.5"
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
            className="flex-1 py-2 px-3 rounded-[var(--radius-input)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-stone-dark)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-colors flex items-center justify-center gap-1.5"
          >
            <ShieldAlert size={14} />
            <span>Report &amp; block</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
