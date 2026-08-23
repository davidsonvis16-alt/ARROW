import { supabase } from '../lib/supabase';
import { UserProfile, MatchRecord } from '../types';
import { profileService } from './profileService';

export const likeService = {
  /**
   * Send an Arrow (Like) to a profile
   * The database trigger automatically creates a match row in public.arrow_matches if mutual like occurs
   */
  async likeProfile(
    fromUserId: string,
    toUserId: string
  ): Promise<{ isMatch: boolean; matchRecord?: MatchRecord }> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    if (fromUserId === toUserId) {
      throw new Error('Cannot like your own profile');
    }

    // Insert or update like record
    const { error: likeError } = await supabase
      .from('arrow_likes')
      .upsert(
        {
          from_user_id: fromUserId,
          to_user_id: toUserId,
          is_pass: false,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'from_user_id,to_user_id' }
      );

    if (likeError) {
      throw likeError;
    }

    // Check if match was created by database trigger
    const u1 = fromUserId < toUserId ? fromUserId : toUserId;
    const u2 = fromUserId < toUserId ? toUserId : fromUserId;

    const { data: matchData } = await supabase
      .from('arrow_matches')
      .select('*')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle();

    if (matchData) {
      return {
        isMatch: true,
        matchRecord: {
          id: matchData.id,
          user1Id: matchData.user1_id,
          user2Id: matchData.user2_id,
          matchedAt: matchData.matched_at,
          lastInteractionAt: matchData.last_interaction_at,
        },
      };
    }

    return { isMatch: false };
  },

  /**
   * Pass on a profile
   */
  async passProfile(fromUserId: string, toUserId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('arrow_likes')
      .upsert(
        {
          from_user_id: fromUserId,
          to_user_id: toUserId,
          is_pass: true,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'from_user_id,to_user_id' }
      );

    if (error) {
      console.error('Error passing profile:', error);
      throw error;
    }
  },

  /**
   * Get incoming likes (Arrows received by the user from people they haven't passed or matched with yet)
   */
  async getReceivedLikes(userId: string): Promise<Array<{ profile: UserProfile }>> {
    if (!supabase) return [];

    // Get likes directed to this user that are not passes
    const { data: likesData, error: likesError } = await supabase
      .from('arrow_likes')
      .select('from_user_id, created_at')
      .eq('to_user_id', userId)
      .eq('is_pass', false)
      .order('created_at', { ascending: false });

    if (likesError || !likesData) return [];

    // Filter out users already liked/passed back or matched
    const results: Array<{ profile: UserProfile }> = [];

    for (const item of likesData) {
      const senderProfile = await profileService.getProfile(item.from_user_id);
      if (senderProfile) {
        results.push({ profile: senderProfile });
      }
    }

    return results;
  },

  /**
   * Get likes sent by this user
   */
  async getSentLikes(userId: string): Promise<Array<{ profile: UserProfile; isPass: boolean }>> {
    if (!supabase) return [];

    const { data: likesData, error } = await supabase
      .from('arrow_likes')
      .select('to_user_id, is_pass, created_at')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !likesData) return [];

    const results: Array<{ profile: UserProfile; isPass: boolean }> = [];

    for (const item of likesData) {
      const targetProfile = await profileService.getProfile(item.to_user_id);
      if (targetProfile) {
        results.push({
          profile: targetProfile,
          isPass: item.is_pass,
        });
      }
    }

    return results;
  },
};
