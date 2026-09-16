import { rpc, rpcSafe } from './rpc';
import { hydrateProfile } from './profileService';
import { MatchWithProfile, MessagePreview } from '../types';

interface RawMatch {
  id: string;
  user1Id: string;
  user2Id: string;
  matchedAt: string;
  lastInteractionAt?: string;
  partnerProfile: unknown;
  unreadCount: number;
  lastMessage: MessagePreview | null;
}

export const matchService = {
  /**
   * One call returns every match with its partner profile already attached.
   * The old implementation fetched matches, then looked up each partner by id
   * in a loop — which is both a round trip per row and exactly the pattern
   * that invites IDOR.
   */
  async getMatches(): Promise<MatchWithProfile[]> {
    const raw = await rpcSafe<RawMatch[]>('arrow_get_matches', {}, []);

    const matches = await Promise.all(
      raw.map(async (record): Promise<MatchWithProfile | null> => {
        const partnerProfile = await hydrateProfile(record.partnerProfile);
        if (!partnerProfile) return null;

        return {
          id: record.id,
          user1Id: record.user1Id,
          user2Id: record.user2Id,
          matchedAt: record.matchedAt,
          lastInteractionAt: record.lastInteractionAt,
          partnerProfile,
          unreadCount: Number(record.unreadCount || 0),
          lastMessage: record.lastMessage,
        };
      })
    );

    return matches.filter((m): m is MatchWithProfile => m !== null);
  },

  /** Membership is proven server-side before anything is removed. */
  async unmatchUser(matchId: string): Promise<void> {
    await rpc('arrow_unmatch', { p_match_id: matchId });
  },
};
