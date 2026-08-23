import {
  UserProfile,
  DatingPreferences,
  LikeRecord,
  MatchRecord,
  BlockRecord,
  ReportRecord,
  FilterState,
} from '../types';

const STORAGE_KEYS = {
  CURRENT_USER_ID: 'arrow_current_user_id',
  PROFILES: 'arrow_profiles',
  LIKES: 'arrow_likes',
  MATCHES: 'arrow_matches',
  BLOCKS: 'arrow_blocks',
  REPORTS: 'arrow_reports',
  PREFERENCES: 'arrow_preferences',
};

// Calculate age accurately from date of birth (YYYY-MM-DD)
export function calculateAge(dobString: string): number {
  if (!dobString) return 0;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function isAdult(dobString: string): boolean {
  return calculateAge(dobString) >= 18;
}

class StorageService {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  // --- Current User Session ---
  getCurrentUserId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
  }

  setCurrentUserId(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    }
  }

  // --- Profiles ---
  getAllProfiles(): UserProfile[] {
    const rawProfiles = this.get<UserProfile[]>(STORAGE_KEYS.PROFILES, []);
    // Filter out old fake/mock profiles if any exist in local storage
    const cleaned = rawProfiles.filter(
      (p) => !p.id.startsWith('user_clara_') && !p.id.startsWith('user_marcus_') && !p.id.startsWith('user_elena_')
    );
    if (cleaned.length !== rawProfiles.length) {
      this.set(STORAGE_KEYS.PROFILES, cleaned);
    }
    return cleaned;
  }

  saveProfile(profile: UserProfile): void {
    const profiles = this.getAllProfiles();
    const index = profiles.findIndex((p) => p.id === profile.id);
    const updated = {
      ...profile,
      age: calculateAge(profile.dateOfBirth),
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      profiles[index] = updated;
    } else {
      profiles.push(updated);
    }
    this.set(STORAGE_KEYS.PROFILES, profiles);
  }

  getProfile(id: string): UserProfile | null {
    const profiles = this.getAllProfiles();
    return profiles.find((p) => p.id === id) || null;
  }

  deleteProfile(id: string): void {
    let profiles = this.getAllProfiles();
    profiles = profiles.filter((p) => p.id !== id);
    this.set(STORAGE_KEYS.PROFILES, profiles);

    // Clean up likes, matches, blocks
    let likes = this.getLikes();
    likes = likes.filter((l) => l.fromUserId !== id && l.toUserId !== id);
    this.set(STORAGE_KEYS.LIKES, likes);

    let matches = this.getMatches();
    matches = matches.filter((m) => m.user1Id !== id && m.user2Id !== id);
    this.set(STORAGE_KEYS.MATCHES, matches);

    if (this.getCurrentUserId() === id) {
      this.setCurrentUserId(null);
    }
  }

  // --- Preferences ---
  getPreferences(userId: string): DatingPreferences {
    const allPrefs = this.get<Record<string, DatingPreferences>>(STORAGE_KEYS.PREFERENCES, {});
    return (
      allPrefs[userId] || {
        ageMin: 18,
        ageMax: 45,
        genderPreference: ['everyone'],
        locationPreference: '',
        intentions: [],
      }
    );
  }

  savePreferences(userId: string, prefs: DatingPreferences): void {
    const allPrefs = this.get<Record<string, DatingPreferences>>(STORAGE_KEYS.PREFERENCES, {});
    allPrefs[userId] = prefs;
    this.set(STORAGE_KEYS.PREFERENCES, allPrefs);
  }

  // --- Likes & Passes ---
  getLikes(): LikeRecord[] {
    return this.get<LikeRecord[]>(STORAGE_KEYS.LIKES, []);
  }

  recordLike(fromUserId: string, toUserId: string, isPass: boolean): { isMatch: boolean; match?: MatchRecord } {
    if (fromUserId === toUserId) {
      throw new Error('Self-interactions are strictly forbidden.');
    }

    const likes = this.getLikes();
    // Remove any previous vote from this user to that user
    const filteredLikes = likes.filter(
      (l) => !(l.fromUserId === fromUserId && l.toUserId === toUserId)
    );

    const newLike: LikeRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : `like_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      fromUserId,
      toUserId,
      isPass,
      createdAt: new Date().toISOString(),
    };

    filteredLikes.push(newLike);
    this.set(STORAGE_KEYS.LIKES, filteredLikes);

    if (isPass) {
      return { isMatch: false };
    }

    // Check if the other user has also liked this user (mutual like)
    const reverseLike = filteredLikes.find(
      (l) => l.fromUserId === toUserId && l.toUserId === fromUserId && !l.isPass
    );

    if (reverseLike) {
      // Create Match
      const matches = this.getMatches();
      const existingMatch = matches.find(
        (m) =>
          (m.user1Id === fromUserId && m.user2Id === toUserId) ||
          (m.user1Id === toUserId && m.user2Id === fromUserId)
      );

      if (!existingMatch) {
        const newMatch: MatchRecord = {
          id: crypto.randomUUID ? crypto.randomUUID() : `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          user1Id: fromUserId,
          user2Id: toUserId,
          matchedAt: new Date().toISOString(),
          lastInteractionAt: new Date().toISOString(),
        };
        matches.push(newMatch);
        this.set(STORAGE_KEYS.MATCHES, matches);
        return { isMatch: true, match: newMatch };
      }
      return { isMatch: true, match: existingMatch };
    }

    return { isMatch: false };
  }

  // --- Matches ---
  getMatches(): MatchRecord[] {
    return this.get<MatchRecord[]>(STORAGE_KEYS.MATCHES, []);
  }

  getUserMatches(userId?: string | null): Array<MatchRecord & { partnerProfile: UserProfile }> {
    if (!userId) return [];
    const matches = this.getMatches();
    const blocks = this.getBlockedUserIds(userId);
    const userMatches = matches.filter(
      (m) => m.user1Id === userId || m.user2Id === userId
    );

    const result: Array<MatchRecord & { partnerProfile: UserProfile }> = [];

    for (const m of userMatches) {
      const partnerId = m.user1Id === userId ? m.user2Id : m.user1Id;
      if (blocks.includes(partnerId)) continue;

      const partner = this.getProfile(partnerId);
      if (partner) {
        result.push({
          ...m,
          partnerProfile: partner,
        });
      }
    }

    // Sort by recent matches first
    return result.sort(
      (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime()
    );
  }

  unmatch(currentUserId: string, matchId: string): void {
    let matches = this.getMatches();
    matches = matches.filter((m) => m.id !== matchId);
    this.set(STORAGE_KEYS.MATCHES, matches);
  }

  // --- Blocks ---
  getBlocks(): BlockRecord[] {
    return this.get<BlockRecord[]>(STORAGE_KEYS.BLOCKS, []);
  }

  getBlockedUserIds(userId?: string | null): string[] {
    if (!userId) return [];
    const blocks = this.getBlocks();
    return blocks
      .filter((b) => b.blockerId === userId)
      .map((b) => b.blockedId);
  }

  blockUser(blockerId: string, blockedId: string): void {
    const blocks = this.getBlocks();
    const exists = blocks.some((b) => b.blockerId === blockerId && b.blockedId === blockedId);
    if (!exists) {
      blocks.push({
        id: `block_${Date.now()}`,
        blockerId,
        blockedId,
        createdAt: new Date().toISOString(),
      });
      this.set(STORAGE_KEYS.BLOCKS, blocks);
    }

    // Also remove match if any
    let matches = this.getMatches();
    matches = matches.filter(
      (m) =>
        !(
          (m.user1Id === blockerId && m.user2Id === blockedId) ||
          (m.user1Id === blockedId && m.user2Id === blockerId)
        )
    );
    this.set(STORAGE_KEYS.MATCHES, matches);
  }

  unblockUser(blockerId: string, blockedId: string): void {
    let blocks = this.getBlocks();
    blocks = blocks.filter((b) => !(b.blockerId === blockerId && b.blockedId === blockedId));
    this.set(STORAGE_KEYS.BLOCKS, blocks);
  }

  // --- Reports ---
  getReports(): ReportRecord[] {
    return this.get<ReportRecord[]>(STORAGE_KEYS.REPORTS, []);
  }

  createReport(report: Omit<ReportRecord, 'id' | 'createdAt' | 'status'>): void {
    const reports = this.getReports();
    reports.push({
      ...report,
      id: `report_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });
    this.set(STORAGE_KEYS.REPORTS, reports);

    // Auto-block reported user for the reporter's safety
    this.blockUser(report.reporterId, report.reportedId);
  }

  // --- Discovery Query ---
  getDiscoverFeed(currentUserId?: string | null, filters?: FilterState): UserProfile[] {
    const allProfiles = this.getAllProfiles();
    const likes = this.getLikes();
    const blockedIds = this.getBlockedUserIds(currentUserId);

    // Get IDs of profiles current user has already acted on (Liked or Passed)
    const actedOnIds = new Set(
      currentUserId
        ? likes.filter((l) => l.fromUserId === currentUserId).map((l) => l.toUserId)
        : []
    );

    return allProfiles.filter((p) => {
      // Must not be self
      if (currentUserId && p.id === currentUserId) return false;
      // Must not be blocked
      if (blockedIds.includes(p.id)) return false;
      // Must not be already acted on
      if (actedOnIds.has(p.id)) return false;

      // Apply Filters if provided
      if (filters) {
        if (filters.ageMin && p.age < filters.ageMin) return false;
        if (filters.ageMax && p.age > filters.ageMax) return false;
        if (filters.genders && filters.genders.length > 0 && !filters.genders.includes('everyone')) {
          if (!filters.genders.includes(p.gender)) return false;
        }
        if (filters.location && filters.location.trim() !== '') {
          if (!p.location.toLowerCase().includes(filters.location.toLowerCase().trim())) {
            return false;
          }
        }
        if (filters.interests && filters.interests.length > 0) {
          const hasCommonInterest = filters.interests.some((i) => p.interests.includes(i));
          if (!hasCommonInterest) return false;
        }
      }

      return true;
    });
  }

  // --- Incoming Likes (People who liked current user) ---
  getIncomingLikes(currentUserId?: string | null): Array<{ like: LikeRecord; profile: UserProfile }> {
    if (!currentUserId) return [];
    const likes = this.getLikes();
    const matches = this.getMatches();
    const blockedIds = this.getBlockedUserIds(currentUserId);

    // Matches set
    const matchedUserIds = new Set(
      matches
        .filter((m) => m.user1Id === currentUserId || m.user2Id === currentUserId)
        .map((m) => (m.user1Id === currentUserId ? m.user2Id : m.user1Id))
    );

    // Likes sent to current user that were NOT passes, NOT yet matched, and from non-blocked users
    const incoming = likes.filter(
      (l) =>
        l.toUserId === currentUserId &&
        !l.isPass &&
        !blockedIds.includes(l.fromUserId) &&
        !matchedUserIds.has(l.fromUserId)
    );

    const result: Array<{ like: LikeRecord; profile: UserProfile }> = [];
    for (const l of incoming) {
      const p = this.getProfile(l.fromUserId);
      if (p) {
        result.push({ like: l, profile: p });
      }
    }
    return result;
  }
}

export const storageService = new StorageService();
