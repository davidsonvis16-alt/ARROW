import { supabase } from '../lib/supabase';
import { rpc, rpcSafe } from './rpc';
import { ChatMessage } from '../types';

/**
 * In-app chat for matched pairs.
 *
 * Every function here is match-scoped and the server proves membership before
 * doing anything, so knowing a match id is not enough to read or write a
 * conversation. The Realtime subscription is safe for the same reason: the
 * SELECT policy on `arrow_messages` only admits rows from a match you are in.
 */
export const messageService = {
  async getMessages(matchId: string, before?: string): Promise<ChatMessage[]> {
    return rpcSafe<ChatMessage[]>(
      'arrow_get_messages',
      { p_match_id: matchId, p_limit: 100, p_before: before ?? null },
      []
    );
  },

  async sendMessage(matchId: string, body: string): Promise<ChatMessage> {
    return rpc<ChatMessage>('arrow_send_message', { p_match_id: matchId, p_body: body });
  },

  async markRead(matchId: string): Promise<number> {
    const data = await rpcSafe<{ marked: number }>(
      'arrow_mark_messages_read',
      { p_match_id: matchId },
      { marked: 0 }
    );
    return data.marked;
  },

  /**
   * Listen for the partner's messages in an open conversation. Returns an
   * unsubscribe function, or a no-op when running without Supabase.
   */
  subscribe(matchId: string, onMessage: (message: ChatMessage) => void): () => void {
    if (!supabase) return () => undefined;

    const channel = supabase
      .channel(`arrow_messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'arrow_messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            match_id: string;
            sender_id: string;
            body: string;
            created_at: string;
            read_at: string | null;
          };

          onMessage({
            id: row.id,
            matchId: row.match_id,
            body: row.body,
            // Resolved by the caller against the current session; the row
            // itself carries the sender, not a point of view.
            isMine: false,
            createdAt: row.created_at,
            readAt: row.read_at,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
