import { supabase } from '../lib/supabase';
import { UserProfile, MatchRecord } from '../types';
import { profileService } from './profileService';

export const matchService = {
  /**
   * Get all active matches for a user
   */
  async getMatches(userId: string): Promise<Array<MatchRecord & { partnerProfile: UserProfile }>> {
    if (!supabase) return [];

    const { data: matchesData, error } = await supabase
      .from('arrow_matches')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('matched_at', { ascending: false });

    if (error || !matchesData) {
      console.warn('Error fetching matches:', error);
      return [];
    }

    const results: Array<MatchRecord & { partnerProfile: UserProfile }> = [];

    for (const record of matchesData) {
      const partnerId = record.user1_id === userId ? record.user2_id : record.user1_id;
      const partnerProfile = await profileService.getProfile(partnerId);

      if (partnerProfile) {
        results.push({
          id: record.id,
          user1Id: record.user1_id,
          user2Id: record.user2_id,
          matchedAt: record.matched_at,
          lastInteractionAt: record.last_interaction_at,
          partnerProfile,
        });
      }
    }

    return results;
  },

  /**
   * Unmatch a partner (removes match record from Supabase database)
   */
  async unmatchUser(matchId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('arrow_matches')
      .delete()
      .eq('id', matchId);

    if (error) {
      console.error('Error unmatching:', error);
      throw error;
    }
  },
};
