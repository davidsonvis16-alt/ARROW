import React, { useState } from 'react';
import { UserProfile, BlockRecord } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
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
  Users,
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
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const allProfiles = storageService.getAllProfiles();
  const blockedIds = storageService.getBlockedUserIds(currentUser.id);
  const blockedProfiles = allProfiles.filter((p) => blockedIds.includes(p.id));

  const handleUnblock = (blockedId: string, name: string) => {
    storageService.unblockUser(currentUser.id, blockedId);
    showToast(`Unblocked ${name}`, 'info');
  };

  const handlePermanentDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
      showToast('Your account and data have been deleted permanently', 'info');
    } catch (err) {
      showToast('Failed to delete account', 'error');
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
        <div className="p-4 bg-[#FFFFFF] rounded-2xl border border-[#E2DDD5] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#EBE8E1] border border-[#E2DDD5]">
              <img
                src={currentUser.photos[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                alt={currentUser.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111111]">{currentUser.name}</h3>
              <p className="text-[11px] text-[#7A766E]">
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
            className="text-xs font-bold text-[#E85D2A] hover:underline"
          >
            Edit
          </button>
        </div>

        {/* Core Settings Menu */}
        <div className="space-y-1.5 bg-[#FFFFFF] rounded-2xl border border-[#E2DDD5] p-2 divide-y divide-[#EFECE6]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPreferences();
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[#FAF8F4] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sliders size={16} className="text-[#111111]" />
              <div>
                <p className="text-xs font-bold text-[#111111]">
                  Dating Discovery Scope
                </p>
                <p className="text-[10px] text-[#7A766E]">
                  Age filter, genders, and locations
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#7A766E]">→</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenWhatsApp();
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[#FAF8F4] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageCircle size={16} className="text-[#25D366]" />
              <div>
                <p className="text-xs font-bold text-[#111111]">
                  WhatsApp Connection
                </p>
                <p className="text-[10px] text-[#7A766E]">
                  {currentUser.allowWhatsApp ? 'Enabled for mutual matches' : 'Disabled'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#7A766E]">→</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBlockedUsers(!showBlockedUsers)}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[#FAF8F4] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserX size={16} className="text-[#111111]" />
              <div>
                <p className="text-xs font-bold text-[#111111]">Blocked Users</p>
                <p className="text-[10px] text-[#7A766E]">
                  {blockedIds.length} {blockedIds.length === 1 ? 'user' : 'users'} blocked
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#7A766E]">
              {showBlockedUsers ? '↓' : '→'}
            </span>
          </button>
        </div>

        {/* Blocked Users Expanded List */}
        {showBlockedUsers && (
          <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-2 animate-in fade-in duration-150">
            <h4 className="text-xs font-bold text-[#111111]">Blocked Accounts</h4>
            {blockedProfiles.length === 0 ? (
              <p className="text-xs text-[#7A766E]">No blocked users.</p>
            ) : (
              <div className="space-y-2">
                {blockedProfiles.map((bp) => (
                  <div
                    key={bp.id}
                    className="flex items-center justify-between p-2 bg-white rounded-xl border border-[#E2DDD5]"
                  >
                    <span className="text-xs font-medium text-[#111111]">{bp.name}</span>
                    <button
                      type="button"
                      onClick={() => handleUnblock(bp.id, bp.name)}
                      className="text-[11px] font-bold text-[#E85D2A] hover:underline"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Testing & Multi-Profile Switcher (For local evaluation) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A766E]">
              Profiles & Testing Mode
            </span>
            <button
              type="button"
              onClick={() => setShowProfileSwitcher(!showProfileSwitcher)}
              className="text-[11px] font-bold text-[#111111] hover:underline"
            >
              {showProfileSwitcher ? 'Hide' : 'Switch / Add Profile'}
            </button>
          </div>

          {showProfileSwitcher && (
            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-3 animate-in fade-in duration-150">
              <p className="text-[11px] text-[#7A766E] leading-tight">
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
                        ? 'bg-[#111111] text-white border-[#111111] font-bold'
                        : 'bg-white text-[#111111] border-[#E2DDD5] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <span>{p.name} ({p.age}, {p.location})</span>
                    {p.id === currentUser.id && (
                      <span className="text-[10px] text-[#E85D2A] font-bold">Active</span>
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

        {/* Legal & Safety Section */}
        <div className="space-y-1.5 bg-[#FFFFFF] rounded-2xl border border-[#E2DDD5] p-2 divide-y divide-[#EFECE6]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLegal('safety');
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[#FAF8F4] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-[#E85D2A]" />
              <span className="text-xs font-bold text-[#111111]">Safety Guidelines</span>
            </div>
            <span className="text-xs font-bold text-[#7A766E]">→</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLegal('privacy');
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[#FAF8F4] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-[#17352F]" />
              <span className="text-xs font-bold text-[#111111]">Privacy Policy</span>
            </div>
            <span className="text-xs font-bold text-[#7A766E]">→</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLegal('terms');
            }}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-[#FAF8F4] rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-[#111111]" />
              <span className="text-xs font-bold text-[#111111]">Terms of Service</span>
            </div>
            <span className="text-xs font-bold text-[#7A766E]">→</span>
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
              className="w-full py-2.5 text-xs font-bold text-[#D9383A] hover:bg-[#FDF0F0] rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>Delete Account Permanently</span>
            </button>
          ) : (
            <div className="p-4 bg-[#FDF0F0] rounded-2xl border border-[#F9C3AF] space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start gap-2 text-xs font-bold text-[#D9383A]">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>Confirm Permanent Deletion</span>
              </div>
              <p className="text-[11px] text-[#333333] leading-relaxed">
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
      </div>
    </Modal>
  );
};
