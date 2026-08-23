import { supabase } from '../lib/supabase';

export const blockService = {
  /**
   * Block another user in Supabase
   * Database trigger `arrow_trigger_block_cleanup` automatically wipes any mutual likes or matches
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    if (blockerId === blockedId) {
      throw new Error('Cannot block yourself');
    }

    const { error } = await supabase
      .from('arrow_blocks')
      .upsert(
        {
          blocker_id: blockerId,
          blocked_id: blockedId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'blocker_id,blocked_id' }
      );

    if (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  },

  /**
   * Unblock a previously blocked user
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('arrow_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  },

  /**
   * Get list of blocked user IDs for the current user
   */
  async getBlockedUsers(userId: string): Promise<string[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('arrow_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (error || !data) return [];

    return data.map((b) => b.blocked_id);
  },
};
