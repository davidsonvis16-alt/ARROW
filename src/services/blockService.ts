import { rpc, rpcSafe } from './rpc';
import { BlockedProfile } from '../types';

export const blockService = {
  /** Blocking is symmetric and severs likes and matches in both directions. */
  async blockUser(targetId: string): Promise<void> {
    await rpc('arrow_block_user', { p_target_id: targetId });
  },

  async unblockUser(targetId: string): Promise<void> {
    await rpc('arrow_unblock_user', { p_target_id: targetId });
  },

  /** Enough detail to recognise who you blocked, and nothing more. */
  async getBlockedProfiles(): Promise<BlockedProfile[]> {
    return rpcSafe<BlockedProfile[]>('arrow_get_blocked_profiles', {}, []);
  },
};
