export type Gender = 'woman' | 'man' | 'non-binary' | 'everyone';

export interface PromptItem {
  id: string;
  question: string;
  answer: string;
}

export interface DatingPreferences {
  ageMin: number;
  ageMax: number;
  genderPreference: Gender[];
  locationPreference?: string;
  maxDistanceKm?: number;
  intentions: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  /**
   * Only ever populated for your own profile. Another user's date of birth is
   * not returned by any server function — `age` is the derived value everyone
   * else sees.
   */
  dateOfBirth: string;
  age: number;
  gender: 'woman' | 'man' | 'non-binary';
  location: string;
  bio: string;
  photos: string[];
  interests: string[];
  lookingFor: string;
  prompts: PromptItem[];
  allowWhatsApp: boolean;
  /** Same rule as `dateOfBirth`: yours only. */
  whatsappNumber?: string;
  createdAt: string;
  updatedAt: string;
  isVerifiedAdult: boolean;
  /** Null when the person has hidden their activity. */
  lastActiveAt?: string | null;
  isPaused?: boolean;
  showOnlineStatus?: boolean;
}

export interface LikeRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  isPass: boolean;
  createdAt: string;
}

/** An arrow received or sent, with the other person's profile attached. */
export interface LikeEntry {
  profile: UserProfile;
  isSuper: boolean;
  createdAt: string;
}

export interface MessagePreview {
  body: string;
  createdAt: string;
  isMine: boolean;
}

export interface MatchRecord {
  id: string;
  user1Id: string;
  user2Id: string;
  matchedAt: string;
  lastInteractionAt?: string;
}

export interface MatchWithProfile extends MatchRecord {
  partnerProfile: UserProfile;
  unreadCount: number;
  lastMessage: MessagePreview | null;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  body: string;
  isMine: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface LikeQuota {
  arrowsUsed: number;
  arrowsLimit: number;
  arrowsRemaining: number;
  superUsed: number;
  superLimit: number;
  superRemaining: number;
}

export interface LikeResult {
  isMatch: boolean;
  match?: MatchRecord;
  partner?: UserProfile;
  quota?: LikeQuota;
}

export interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export interface BlockedProfile {
  id: string;
  name: string;
  location: string | null;
  blockedAt: string;
  photo: string | null;
}

/**
 * Mirrors the `arrow_report_reason` enum in supabase/schema.sql. Adding a value
 * here without adding it there makes every report using it fail.
 */
export type ReportReason =
  | 'harassment'
  | 'inappropriate_photos'
  | 'spam_scam'
  | 'underage'
  | 'fake_profile'
  | 'offline_behavior'
  | 'other';

export interface ReportRecord {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: ReportReason;
  details?: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'banned';
}

export type TabType = 'discover' | 'likes' | 'matches' | 'profile';

export interface FilterState {
  ageMin: number;
  ageMax: number;
  genders: Gender[];
  location: string;
  interests: string[];
  lookingFor: string[];
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}
