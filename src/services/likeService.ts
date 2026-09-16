import { rpc, rpcSafe } from './rpc';
import { hydrateProfile } from './profileService';
import { LikeEntry, LikeQuota, LikeResult, UserProfile } from '../types';

interface RawLikeEntry {
  profile: unknown;
  isSuper: boolean;
  createdAt: string;
}

async function hydrateEntries(raw: RawLikeEntry[]): Promise<LikeEntry[]> {
  const entries = await Promise.all(
    raw.map(async (item) => {
      const profile = await hydrateProfile(item.profile);
      return profile ? { profile, isSuper: Boolean(item.isSuper), createdAt: item.createdAt } : null;
    })
  );

  return entries.filter((e): e is LikeEntry => e !== null);
}

export const likeService = {
  /**
   * Send an arrow. The server decides whether this created a match — a client
   * cannot declare one — and returns the partner's profile with the result so
   * the celebration screen needs no follow-up lookup.
   */
  async likeProfile(targetId: string, isSuper = false): Promise<LikeResult> {
    const data = await rpc<{
      isMatch: boolean;
      match?: LikeResult['match'];
      partner?: unknown;
      quota?: LikeQuota;
    }>('arrow_like_profile', { p_target_id: targetId, p_is_super: isSuper });

    return {
      isMatch: Boolean(data.isMatch),
      match: data.match,
      partner: (await hydrateProfile(data.partner)) || undefined,
      quota: data.quota,
    };
  },

  async passProfile(targetId: string): Promise<void> {
    await rpc('arrow_pass_profile', { p_target_id: targetId });
  },

  /** Undo the last swipe, unless it already turned into a match. */
  async rewindLastSwipe(): Promise<{ success: boolean; error?: string; wasPass?: boolean; profile?: UserProfile }> {
    const data = await rpc<{ success: boolean; error?: string; wasPass?: boolean; profile?: unknown }>(
      'arrow_rewind_last_swipe'
    );

    return {
      success: Boolean(data.success),
      error: data.error,
      wasPass: data.wasPass,
      profile: (await hydrateProfile(data.profile)) || undefined,
    };
  },

  async getReceivedLikes(): Promise<LikeEntry[]> {
    return hydrateEntries(await rpcSafe<RawLikeEntry[]>('arrow_get_received_likes', {}, []));
  },

  async getSentLikes(): Promise<LikeEntry[]> {
    return hydrateEntries(await rpcSafe<RawLikeEntry[]>('arrow_get_sent_likes', {}, []));
  },

  async getQuota(): Promise<LikeQuota | null> {
    return rpcSafe<LikeQuota | null>('arrow_get_like_quota', {}, null);
  },
};
