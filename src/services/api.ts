import {
  UserProfile,
  DatingPreferences,
  MatchRecord,
  ReportReason,
  FilterState,
} from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { profileService } from './profileService';
import { likeService } from './likeService';
import { matchService } from './matchService';
import { preferencesService } from './preferencesService';
import { blockService } from './blockService';
import { reportService } from './reportService';
import { authService } from './authService';
import { storageService } from './storageService';

export const api = {
  // Discovery Feed
  async getDiscoverProfiles(currentUserId?: string | null, filters?: FilterState): Promise<UserProfile[]> {
    if (isSupabaseConfigured) {
      return profileService.getDiscoverProfiles(filters);
    }
    return storageService.getDiscoverFeed(currentUserId, filters);
  },

  // Single Profile
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      return profileService.getProfile(userId);
    }
    return storageService.getProfile(userId);
  },

  // Send Arrow (Like)
  async likeProfile(
    fromUserId: string,
    toUserId: string
  ): Promise<{ isMatch: boolean; matchRecord?: MatchRecord }> {
    if (isSupabaseConfigured) {
      return likeService.likeProfile(fromUserId, toUserId);
    }
    const result = storageService.recordLike(fromUserId, toUserId, false);
    return {
      isMatch: result.isMatch,
      matchRecord: result.match,
    };
  },

  // Pass profile
  async passProfile(fromUserId: string, toUserId: string): Promise<void> {
    if (isSupabaseConfigured) {
      return likeService.passProfile(fromUserId, toUserId);
    }
    storageService.recordLike(fromUserId, toUserId, true);
  },

  // Received Likes (Arrows from others)
  async getLikes(currentUserId?: string | null): Promise<Array<{ profile: UserProfile }>> {
    if (!currentUserId) return [];
    if (isSupabaseConfigured) {
      return likeService.getReceivedLikes(currentUserId);
    }
    const raw = storageService.getIncomingLikes(currentUserId);
    return raw.map((r) => ({ profile: r.profile }));
  },

  // User Matches
  async getMatches(
    currentUserId?: string | null
  ): Promise<Array<MatchRecord & { partnerProfile: UserProfile }>> {
    if (!currentUserId) return [];
    if (isSupabaseConfigured) {
      return matchService.getMatches(currentUserId);
    }
    return storageService.getUserMatches(currentUserId);
  },

  // Block user
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (isSupabaseConfigured) {
      return blockService.blockUser(blockerId, blockedId);
    }
    storageService.blockUser(blockerId, blockedId);
  },

  // Unblock user
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    if (isSupabaseConfigured) {
      return blockService.unblockUser(blockerId, blockedId);
    }
    storageService.unblockUser(blockerId, blockedId);
  },

  // Report user
  async reportUser(
    reporterId: string,
    reportedId: string,
    reason: ReportReason,
    details?: string
  ): Promise<void> {
    if (isSupabaseConfigured) {
      return reportService.reportUser(reporterId, reportedId, reason, details);
    }
    storageService.createReport({
      reporterId,
      reportedId,
      reason,
      details,
    });
  },

  // Unmatch
  async unmatchUser(currentUserId: string, matchId: string): Promise<void> {
    if (isSupabaseConfigured) {
      return matchService.unmatchUser(matchId);
    }
    storageService.unmatch(currentUserId, matchId);
  },

  // Update Profile
  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    if (isSupabaseConfigured) {
      return profileService.updateProfile(userId, data);
    }
    const existing = storageService.getProfile(userId);
    if (!existing) {
      throw new Error('Profile not found');
    }
    const updated: UserProfile = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    storageService.saveProfile(updated);
    return updated;
  },

  // Update Preferences
  async updatePreferences(userId: string, prefs: DatingPreferences): Promise<void> {
    if (isSupabaseConfigured) {
      await preferencesService.updatePreferences(userId, prefs);
      return;
    }
    storageService.savePreferences(userId, prefs);
  },

  // Get Preferences
  async getPreferences(userId: string): Promise<DatingPreferences> {
    if (isSupabaseConfigured) {
      return preferencesService.getPreferences(userId);
    }
    return storageService.getPreferences(userId);
  },

  // Delete Account
  async deleteAccount(userId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await authService.signOut();
      return;
    }
    storageService.deleteProfile(userId);
  },

  // Photo Upload
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

    // Local fallback for offline preview
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsDataURL(file);
    });
  },

  // Match WhatsApp Number Retrieval (Private, authorized only upon mutual match)
  async getMatchWhatsApp(matchId: string): Promise<{ allowWhatsApp: boolean; whatsappNumber: string | null }> {
    if (isSupabaseConfigured) {
      return profileService.getMatchWhatsApp(matchId);
    }
    return { allowWhatsApp: true, whatsappNumber: '+1 (555) 019-2834' };
  },
};

export {
  authService,
  profileService,
  likeService,
  matchService,
  preferencesService,
  blockService,
  reportService,
};
