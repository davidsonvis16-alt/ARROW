import { supabase } from '../lib/supabase';
import { rpc, rpcSafe } from './rpc';
import { ChatMessage, MessageReaction } from '../types';

/**
 * In-app chat for matched pairs.
 *
 * Every function here is match-scoped and the server proves membership before
 * doing anything, so knowing a match id is not enough to read or write a
 * conversation. The Realtime subscriptions are safe for the same reason: the
 * SELECT policy on `arrow_messages` only admits rows from a match you are in,
 * and the typing channel is private, authorized by the policy on
 * realtime.messages in the schema.
 */

interface MessageRow {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  reaction?: MessageReaction | null;
}

function toMessage(row: MessageRow, myId: string | null): ChatMessage {
  return {
    id: row.id,
    matchId: row.match_id,
    body: row.body,
    // The row carries the sender, not a point of view, so authorship is
    // resolved against the signed-in user. (read_at is not readable from the
    // table at all — receipts come from arrow_get_messages.)
    isMine: Boolean(myId) && row.sender_id === myId,
    createdAt: row.created_at,
    readAt: null,
    reaction: row.reaction ?? null,
  };
}

export interface ChatSubscription {
  onMessage: (message: ChatMessage) => void;
  onReaction?: (messageId: string, reaction: MessageReaction | null) => void;
  /** The partner marked messages read; refetch to pick up receipts. */
  onRead?: () => void;
  onTyping?: (isTyping: boolean) => void;
}

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

  async react(messageId: string, reaction: MessageReaction | null): Promise<void> {
    await rpc('arrow_react_to_message', { p_message_id: messageId, p_reaction: reaction });
  },

  /**
   * Live updates for one open conversation: new messages, reactions, read
   * events and the partner's typing indicator. Returns an unsubscribe function
   * and a `setTyping` sender, both no-ops without Supabase.
   */
  subscribe(
    matchId: string,
    myId: string | null,
    handlers: ChatSubscription
  ): { unsubscribe: () => void; setTyping: (typing: boolean) => void } {
    if (!supabase) return { unsubscribe: () => undefined, setTyping: () => undefined };
    const client = supabase;

    const changes = client
      .channel(`arrow_messages:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'arrow_messages', filter: `match_id=eq.${matchId}` },
        (payload) => handlers.onMessage(toMessage(payload.new as MessageRow, myId))
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'arrow_messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          handlers.onReaction?.(row.id, row.reaction ?? null);
          // An update to one of my messages that is not a reaction is the
          // partner reading it.
          if (row.sender_id === myId) handlers.onRead?.();
        }
      )
      .subscribe();

    // Typing travels over Broadcast on a private, RLS-authorized channel, so
    // only the two people in the match can send or hear it.
    const typing = client.channel(`arrow-match:${matchId}`, {
      config: { private: true, broadcast: { self: false } },
    });
    typing
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.from !== myId) handlers.onTyping?.(Boolean(payload?.typing));
      })
      .subscribe();

    return {
      unsubscribe: () => {
        client.removeChannel(changes);
        client.removeChannel(typing);
      },
      setTyping: (isTyping: boolean) => {
        typing.send({ type: 'broadcast', event: 'typing', payload: { from: myId, typing: isTyping } });
      },
    };
  },

  /**
   * Every new message across all your matches, for unread badges and alerts.
   * RLS limits the stream to matches you are in; your own sends are skipped.
   */
  subscribeToInbox(myId: string, onIncoming: (message: ChatMessage) => void): () => void {
    if (!supabase) return () => undefined;
    const client = supabase;

    const channel = client
      .channel(`arrow_inbox:${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'arrow_messages' }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.sender_id !== myId) onIncoming(toMessage(row, myId));
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  },
};
