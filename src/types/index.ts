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
  dateOfBirth: string; // YYYY-MM-DD
  age: number; // calculated from dateOfBirth (enforces 18+)
  gender: 'woman' | 'man' | 'non-binary';
  location: string; // General city/region only (e.g. Nairobi, London, NYC)
  bio: string;
  photos: string[];
  interests: string[];
  lookingFor: string; // e.g. "Long-term connection", "Meaningful dating", "Casual & open"
  prompts: PromptItem[];
  allowWhatsApp: boolean;
  whatsappNumber?: string; // Private, never exposed in public profile query
  createdAt: string;
  updatedAt: string;
  isVerifiedAdult: boolean;
}

export interface LikeRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  isPass: boolean;
  createdAt: string;
}

export interface MatchRecord {
  id: string;
  user1Id: string;
  user2Id: string;
  user1Profile?: UserProfile;
  user2Profile?: UserProfile;
  matchedAt: string;
  lastInteractionAt?: string;
}

export interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export type ReportReason =
  | 'harassment'
  | 'spam'
  | 'scam'
  | 'impersonation'
  | 'inappropriate'
  | 'underage'
  | 'other';

export interface ReportRecord {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: ReportReason;
  details?: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'actioned';
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
