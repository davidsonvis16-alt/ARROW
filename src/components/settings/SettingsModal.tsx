import React, { useState } from 'react';
import { UserProfile, PlanInfo } from '../../types';
import { isSupabaseConfigured } from '../../lib/supabase';
import { PLANS } from '../../config/plans';
import { CreatedByEden } from '../brand/Logo';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { SafetySection } from './SafetySection';
import { storageService } from '../../services/storageService';
import { useToast } from '../ui/Toast';
import { LegalDocType } from '../safety/LegalModal';
import {
  User,
  Sliders,
  MessageCircle,
  Shield,
  FileText,
  Lock,
  UserX,
  Trash2,
  LogOut,
  AlertTriangle,
  UserPlus,
  Crown,
  EyeOff,
} from 'lucide-react';

interface SettingsModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onOpenEditProfile: () => void;
  onOpenPreferences: () => void;
  onOpenWhatsApp: () => void;
  onOpenLegal: (type: LegalDocType) => void;
  onLogOut: () => void;
  onDeleteAccount: () => Promise<void>;
  onSwitchProfile: (profileId: string) => void;
  onNewProfile: () => void;
  onTogglePause: (paused: boolean) => Promise<void>;
  onToggleOnlineStatus?: (show: boolean) => Promise<void>;
  planInfo: PlanInfo;
  onOpenPlans: () => void;
  onManageBilling: () => Promise<void>;
  onToggleIncognito: (enabled: boolean) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onOpenEditProfile,
  onOpenPreferences,
  onOpenWhatsApp,
  onOpenLegal,
  onLogOut,
  onDeleteAccount,
  onSwitchProfile,
  onNewProfile,
  onTogglePause,
  onToggleOnlineStatus,
  planInfo,
  onOpenPlans,
  onManageBilling,
  onToggleIncognito,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const allProfiles = storageService.getAllProfiles();

  const handlePermanentDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
      showToast('Your account and data have been deleted permanently', 'info');
    } catch (err: any) {
      // The server explains itself, e.g. "cancel your subscription first".
      showToast(err?.message || 'Could not delete your account', 'error');
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title="Settings & Privacy"
      subtitle="Manage your ARROW account preferences"
    >
      <div className="space-y-6 pb-4">
        {/* Account Info Card */}
        <div className="p-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-subtle)] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <Avatar name={currentUser.name} src={currentUser.photos[0]} size="md" />
            <div>
              <h3 className="text-sm font-bold text-[var(--color-ink)]">{currentUser.name}</h3>
              <p className="text-[11px] text-[var(--color-stone-dark)]">
                {currentUser.age} years old · 18+ Verified Member
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenEditProfile();
            }}
            className="text-xs font-bold text-[var(--color-arrow-orange-text)] hover:underline"
          >
            Edit
          </button>
        </div>

        {/* Membership */}
        <div className="p-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  planInfo.plan === 'premium'
                    ? 'bg-[var(--color-gold-subtle)] text-[var(--color-gold)]'
                    : planInfo.plan === 'plus'
                      ? 'bg-[var(--color-arrow-orange-subtle)] text-[var(--color-arrow-orange-text)]'
                      : 'bg-[var(--color-stone-light)] text-[var(--color-ink)]'
                }`}
              >
                <Crown size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--color-ink)]">
                  Membership · {PLANS[planInfo.plan].name}
                  {planInfo.status === 'trialing' ? ' trial' : ''}
                </p>
                <p className="text-[10px] text-[var(--color-stone-dark)]">
                  {planInfo.plan === 'free'
                    ? 'See who likes you, unlimited arrows and more'
                    : planInfo.currentPeriodEnd
                      ? `${planInfo.renews ? 'Renews' : 'Ends'} ${new Date(planInfo.currentPeriodEnd).toLocaleDateString()}${
                          planInfo.paymentMethod === 'mpesa' ? ' · M-Pesa' : planInfo.paymentMethod === 'card' ? ' · card' : ''
                        } · receipts and cancelling`
                      : 'Active'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPlans();
              }}
              className="text-xs font-bold text-[var(--color-arrow-orange-text)] hover:underline shrink-0"
            >
              {planInfo.plan === 'free' ? 'See plans' : 'Manage'}
            </button>
          </div>

          <label className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--color-border-subtle)] cursor-pointer">
            <span className="flex items-center gap-3">
              <EyeOff size={16} className="text-[var(--color-ink)]" />
              <span>
                <span className="block text-xs font-bold text-[var(--color-ink)]">Incognito</span>
                <span className="block text-[10px] text-[var(--color-stone-dark)]">
                  {planInfo.features.incognito
                    ? 'Only people you send an arrow to can see you'
                    : 'Premium: only people you like can see you'}
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              className="w-5 h-5 accent-[var(--color-arrow-orange)]"
              checked={Boolean(currentUser.isIncognito)}
              onChange={(e) => {
                if (!planInfo.features.incognito && e.target.checked) {
                  onClose();
                  onOpenPlans();
                  return;
                }
                onToggleIncognito(e.target.checked);
              }}
            />
          </label>
        </div>

        {/* Core Settings Menu */}
        <div className="space-y-1.5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-subtle)] p-2 divide-y divide-[var(--color-border-subtle)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPreferences();
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-subtle)] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sliders size={16} className="text-[var(--color-ink)]" />
              <div>
                <p className="text-xs font-bold text-[var(--color-ink)]">
                  Dating Discovery Scope
                </p>
                <p className="text-[10px] text-[var(--color-stone-dark)]">
                  Age filter, genders, and locations
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--color-stone-dark)]">→</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenWhatsApp();
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-subtle)] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageCircle size={16} className="text-[#25D366]" />
              <div>
                <p className="text-xs font-bold text-[var(--color-ink)]">
                  WhatsApp Connection
                </p>
                <p className="text-[10px] text-[var(--color-stone-dark)]">
                  {currentUser.allowWhatsApp ? 'Enabled for mutual matches' : 'Disabled'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--color-stone-dark)]">→</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBlockedUsers(!showBlockedUsers)}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-subtle)] rounded-xl transition-colors"
            aria-expanded={showBlockedUsers}
          >
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-[var(--color-ink)]" />
              <div>
                <p className="text-xs font-bold text-[var(--color-ink)]">Safety &amp; privacy</p>
                <p className="text-[10px] text-[var(--color-stone-dark)]">
                  Pause your profile, manage blocks, choose a theme
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--color-stone-dark)]">
              {showBlockedUsers ? '\u2193' : '\u2192'}
            </span>
          </button>
        </div>

        {showBlockedUsers && (
          <div className="arrow-rise">
            <SafetySection
              isPaused={Boolean(currentUser.isPaused)}
              showOnlineStatus={currentUser.showOnlineStatus !== false}
              onTogglePause={onTogglePause}
              onToggleOnlineStatus={onToggleOnlineStatus}
            />
          </div>
        )}

        {/* Several profiles only exist in the offline demo, where they all live
            on this device. A real account is one person. */}
        {!isSupabaseConfigured && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">
              Profiles & Testing Mode
            </span>
            <button
              type="button"
              onClick={() => setShowProfileSwitcher(!showProfileSwitcher)}
              className="text-[11px] font-bold text-[var(--color-ink)] hover:underline"
            >
              {showProfileSwitcher ? 'Hide' : 'Switch / Add Profile'}
            </button>
          </div>

          {showProfileSwitcher && (
            <div className="p-3.5 bg-[var(--color-surface-subtle)] rounded-2xl border border-[var(--color-border-subtle)] space-y-3 animate-in fade-in duration-150">
              <p className="text-[11px] text-[var(--color-stone-dark)] leading-tight">
                Switch accounts or add a new profile to test discovery, mutual likes, and WhatsApp matching:
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {allProfiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSwitchProfile(p.id);
                      onClose();
                    }}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      p.id === currentUser.id
                        ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)] font-bold'
                        : 'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-subtle)]'
                    }`}
                  >
                    <span>{p.name} ({p.age}, {p.location})</span>
                    {p.id === currentUser.id && (
                      <span className="text-[10px] text-[var(--color-arrow-orange-text)] font-bold">Active</span>
                    )}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => {
                  onClose();
                  onNewProfile();
                }}
                icon={<UserPlus size={14} />}
              >
                Create Another Profile
              </Button>
            </div>
          )}
        </div>
        )}

        {/* Legal & Safety Section */}
        <div className="space-y-1.5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-subtle)] p-2 divide-y divide-[var(--color-border-subtle)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLegal('safety');
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-subtle)] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-[var(--color-arrow-orange-text)]" />
              <span className="text-xs font-bold text-[var(--color-ink)]">Safety Guidelines</span>
            </div>
            <span className="text-xs font-bold text-[var(--color-stone-dark)]">→</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLegal('privacy');
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-subtle)] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-[var(--color-forest)]" />
              <span className="text-xs font-bold text-[var(--color-ink)]">Privacy Policy</span>
            </div>
            <span className="text-xs font-bold text-[var(--color-stone-dark)]">→</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLegal('terms');
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-subtle)] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-[var(--color-ink)]" />
              <span className="text-xs font-bold text-[var(--color-ink)]">Terms of Service</span>
            </div>
            <span className="text-xs font-bold text-[var(--color-stone-dark)]">→</span>
          </button>
        </div>

        {/* Danger Zone: Log Out & Permanent Deletion */}
        <div className="space-y-2 pt-2">
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              onClose();
              onLogOut();
            }}
            icon={<LogOut size={16} />}
          >
            Log Out
          </Button>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 text-xs font-bold text-[var(--color-danger-text)] hover:bg-[var(--color-danger-subtle)] rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>Delete Account Permanently</span>
            </button>
          ) : (
            <div className="p-4 bg-[var(--color-danger-subtle)] rounded-2xl border border-[var(--color-danger)] space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start gap-2 text-xs font-bold text-[var(--color-danger-text)]">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>Confirm Permanent Deletion</span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-soft)] leading-relaxed">
                This action is irreversible. All your profile information, photos, likes, matches, and settings will be permanently wiped.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Keep Account
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  disabled={isDeleting}
                  onClick={handlePermanentDelete}
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <CreatedByEden className="text-center" />
      </div>
    </Modal>
  );
};
