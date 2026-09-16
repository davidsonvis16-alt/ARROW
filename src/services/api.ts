import {
  BlockedProfile,
  ChatMessage,
  DatingPreferences,
  FilterState,
  LikeEntry,
  LikeQuota,
  LikeResult,
  MatchWithProfile,
  ReportReason,
  UserProfile,
} from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { profileService } from './profileService';
import { likeService } from './likeService';
import { matchService } from './matchService';
import { messageService } from './messageService';
import { preferencesService } from './preferencesService';
import { blockService } from './blockService';
import { reportService } from './reportService';
import { authService } from './authService';
import { storageService } from './storageService';

/**
 * The application's data layer.
 *
 * Note the signatures: nothing here takes a "current user" id. On the Supabase
 * path the server derives the actor from the session, and in the local demo
 * path the actor comes from storageService. Passing an actor id across this
 * boundary is what let a tampered client act as somebody else, so the
 * parameter no longer exists to be tampered with.
 */

function localActor(): string | null {
  return storageService.getCurrentUserId();
}

export const api = {
  // ---------------------------------------------------------------- discovery
  async getDiscoverProfiles(filters?: FilterState): Promise<UserProfile[]> {
    if (isSupabaseConfigured) {
      return profileService.getDiscoverProfiles(filters);
    }
    return storageService.getDiscoverFeed(localActor(), filters);
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      return profileService.getProfile(userId);
    }
    return storageService.getProfile(userId);
  },

  async getMyProfile(): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      return profileService.getMyProfile();
    }
    const id = localActor();
    return id ? storageService.getProfile(id) : null;
  },

  // -------------------------------------------------------------------- likes
  async likeProfile(targetId: string, isSuper = false): Promise<LikeResult> {
    if (isSupabaseConfigured) {
      return likeService.likeProfile(targetId, isSuper);
    }

    const actor = localActor();
    if (!actor) throw new Error('Log in to send an arrow.');

    const result = storageService.recordLike(actor, targetId, false);
    return {
      isMatch: result.isMatch,
      match: result.match,
      partner: storageService.getProfile(targetId) || undefined,
    };
  },

  async passProfile(targetId: string): Promise<void> {
    if (isSupabaseConfigured) {
      return likeService.passProfile(targetId);
    }
    const actor = localActor();
    if (actor) storageService.recordLike(actor, targetId, true);
  },

  async rewindLastSwipe(): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    if (isSupabaseConfigured) {
      return likeService.rewindLastSwipe();
    }
    return { success: false, error: 'Undo needs a connected account.' };
  },

  async getLikes(): Promise<LikeEntry[]> {
    if (isSupabaseConfigured) {
      return likeService.getReceivedLikes();
    }
    return storageService
      .getIncomingLikes(localActor())
      .map((r) => ({ profile: r.profile, isSuper: false, createdAt: r.like.createdAt }));
  },

  async getSentLikes(): Promise<LikeEntry[]> {
    if (isSupabaseConfigured) {
      return likeService.getSentLikes();
    }
    return [];
  },

  async getLikeQuota(): Promise<LikeQuota | null> {
    if (isSupabaseConfigured) {
      return likeService.getQuota();
    }
    return null;
  },

  // ------------------------------------------------------------------ matches
  async getMatches(): Promise<MatchWithProfile[]> {
    if (isSupabaseConfigured) {
      return matchService.getMatches();
    }

    return storageService.getUserMatches(localActor()).map((m) => ({
      ...m,
      unreadCount: 0,
      lastMessage: null,
    }));
  },

  async unmatchUser(matchId: string): Promise<void> {
    if (isSupabaseConfigured) {
      return matchService.unmatchUser(matchId);
    }
    const actor = localActor();
    if (actor) storageService.unmatch(actor, matchId);
  },

  // ----------------------------------------------------------------- messages
  async getMessages(matchId: string): Promise<ChatMessage[]> {
    if (isSupabaseConfigured) {
      return messageService.getMessages(matchId);
    }
    return [];
  },

  async sendMessage(matchId: string, body: string): Promise<ChatMessage> {
    if (isSupabaseConfigured) {
      return messageService.sendMessage(matchId, body);
    }
    throw new Error('Messaging needs a connected account.');
  },

  async markMessagesRead(matchId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await messageService.markRead(matchId);
    }
  },

  subscribeToMessages(matchId: string, onMessage: (message: ChatMessage) => void): () => void {
    if (isSupabaseConfigured) {
      return messageService.subscribe(matchId, onMessage);
    }
    return () => undefined;
  },

  // ------------------------------------------------------------------- safety
  async blockUser(targetId: string): Promise<void> {
    if (isSupabaseConfigured) {
      return blockService.blockUser(targetId);
    }
    const actor = localActor();
    if (actor) storageService.blockUser(actor, targetId);
  },

  async unblockUser(targetId: string): Promise<void> {
    if (isSupabaseConfigured) {
      return blockService.unblockUser(targetId);
    }
    const actor = localActor();
    if (actor) storageService.unblockUser(actor, targetId);
  },

  async getBlockedProfiles(): Promise<BlockedProfile[]> {
    if (isSupabaseConfigured) {
      return blockService.getBlockedProfiles();
    }

    const actor = localActor();
    if (!actor) return [];

    return storageService.getBlockedUserIds(actor).map((id) => {
      const profile = storageService.getProfile(id);
      return {
        id,
        name: profile?.name || 'Someone',
        location: profile?.location || null,
        blockedAt: new Date().toISOString(),
        photo: profile?.photos?.[0] || null,
      };
    });
  },

  async reportUser(
    reportedId: string,
    reason: ReportReason,
    details?: string,
    alsoBlock = true
  ): Promise<void> {
    if (isSupabaseConfigured) {
      return reportService.reportUser(reportedId, reason, details, alsoBlock);
    }

    const actor = localActor();
    if (!actor) return;

    storageService.createReport({ reporterId: actor, reportedId, reason, details });
    if (alsoBlock) storageService.blockUser(actor, reportedId);
  },

  // ------------------------------------------------------------------ profile
  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    if (isSupabaseConfigured) {
      return profileService.updateProfile(data);
    }

    const actor = localActor();
    const existing = actor ? storageService.getProfile(actor) : null;
    if (!existing) throw new Error('Profile not found');

    const updated: UserProfile = { ...existing, ...data, updatedAt: new Date().toISOString() };
    storageService.saveProfile(updated);
    return updated;
  },

  async setWhatsApp(allow: boolean, number?: string): Promise<UserProfile> {
    if (isSupabaseConfigured) {
      return profileService.setWhatsApp(allow, number);
    }
    return this.updateProfile({ allowWhatsApp: allow, whatsappNumber: number });
  },

  async setVisibility(isPaused: boolean, showOnlineStatus?: boolean): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      return profileService.setVisibility(isPaused, showOnlineStatus);
    }
    return this.updateProfile({ isPaused, showOnlineStatus });
  },

  async updatePreferences(prefs: DatingPreferences): Promise<void> {
    if (isSupabaseConfigured) {
      await preferencesService.updatePreferences(prefs);
      return;
    }
    const actor = localActor();
    if (actor) storageService.savePreferences(actor, prefs);
  },

  async getPreferences(): Promise<DatingPreferences> {
    if (isSupabaseConfigured) {
      return preferencesService.getPreferences();
    }
    const actor = localActor();
    return storageService.getPreferences(actor || '');
  },

  async deleteAccount(): Promise<void> {
    if (isSupabaseConfigured) {
      await authService.deleteAccount();
      return;
    }
    const actor = localActor();
    if (actor) storageService.deleteProfile(actor);
  },

  // ------------------------------------------------------------------- photos
  async uploadPhoto(file: File, userId: string): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select a valid image file (JPEG, PNG, WebP).');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB.');
    }

    if (isSupabaseConfigured) {
      return profileService.uploadProfilePhoto(userId, file);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Failed to read image file'));
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsDataURL(file);
    });
  },

  async deletePhoto(photoRef: string): Promise<void> {
    if (isSupabaseConfigured) {
      return profileService.deleteProfilePhoto(photoRef);
    }
  },

  // ------------------------------------------------------------------ contact
  async getMatchWhatsApp(matchId: string): Promise<{ allowWhatsApp: boolean; whatsappNumber: string | null }> {
    if (isSupabaseConfigured) {
      return profileService.getMatchWhatsApp(matchId);
    }
    return { allowWhatsApp: true, whatsappNumber: '+1 (555) 019-2834' };
  },

  async touchActivity(): Promise<void> {
    if (isSupabaseConfigured) {
      await profileService.touchActivity();
    }
  },
};

export {
  authService,
  profileService,
  likeService,
  matchService,
  messageService,
  preferencesService,
  blockService,
  reportService,
};
