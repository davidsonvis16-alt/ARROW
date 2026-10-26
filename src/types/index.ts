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
  /** Displayable URLs (short-lived signed URLs on Supabase). */
  photos: string[];
  /**
   * Yours only: the stored reference behind each entry in `photos`, in the
   * same order. Deleting or reordering needs these — a signed URL expires and
   * is not what the server stores.
   */
  photoRefs?: string[];
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
  /** Yours only: whether incognito is on and actually in effect. */
  isIncognito?: boolean;
  /** Yours only: the plan the server says you are on right now. */
  plan?: PlanId;
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
  /** Optional note sent with a super arrow (Plus and Premium). */
  note?: string | null;
  createdAt: string;
}

/**
 * What the server chose to reveal about who liked you. On the free plan only
 * super arrows arrive as entries; everyone else is just a number, because the
 * server never sends their identity.
 */
export interface LikesInbox {
  entries: LikeEntry[];
  hiddenCount: number;
  locked: boolean;
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
  /**
   * For your own messages this is a read receipt and only arrives on Premium.
   * For theirs it is when you read it.
   */
  readAt: string | null;
  reaction?: MessageReaction | null;
}

/** Mirrors check_arrow_message_reaction in supabase/schema.sql. */
export const MESSAGE_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const;
export type MessageReaction = (typeof MESSAGE_REACTIONS)[number];

export interface LikeQuota {
  plan?: PlanId;
  arrowsUsed: number;
  arrowsLimit: number;
  arrowsRemaining: number;
  arrowsUnlimited?: boolean;
  superUsed: number;
  superLimit: number;
  superRemaining: number;
  rewindsRemaining?: number;
  rewindsUnlimited?: boolean;
}

export type PlanId = 'free' | 'plus' | 'premium';

export interface PlanFeatures {
  seeLikes: boolean;
  advancedFilters: boolean;
  arrowNotes: boolean;
  readReceipts: boolean;
  incognito: boolean;
  boost: boolean;
}

/** Mirrors arrow_get_my_plan. Every flag here is enforced server-side too. */
export type PaymentMethod = 'card' | 'mpesa';

export interface PlanInfo {
  plan: PlanId;
  status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled';
  source: 'none' | 'trial' | 'card' | 'mpesa' | 'grant';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** How the current paid plan is paid for; null on free or trial. */
  paymentMethod: PaymentMethod | null;
  /** True only for a card plan that will charge again automatically. */
  renews: boolean;
  canManageBilling: boolean;
  trialAvailable: boolean;
  trialDays: number;
  features: PlanFeatures;
  boostActiveUntil: string | null;
  boostsRemaining: number;
}

/** One successful payment, as shown in the receipts list. */
export interface PaymentRecord {
  reference: string;
  plan: Exclude<PlanId, 'free'>;
  method: PaymentMethod;
  amountMinor: number;
  currency: string;
  /** For an M-Pesa pass: the end of the time this payment bought. */
  coversUntil: string | null;
  paidAt: string;
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

export type TabType = 'discover' | 'likes' | 'matches' | 'history' | 'profile';

/** Someone you swiped on, newest first. */
export interface HistoryEntry {
  profile: UserProfile;
  action: 'pass' | 'arrow' | 'super';
  isMatch: boolean;
  at: string;
}

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
