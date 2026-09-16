import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, MatchWithProfile } from '../../types';
import { api } from '../../services/api';
import { Send, Loader2, ShieldAlert } from 'lucide-react';

interface ChatPanelProps {
  match: MatchWithProfile;
  onMessageSent?: () => void;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Conversation with a match.
 *
 * Everything here is addressed by match id and the server proves membership on
 * every call, so this component never needs to know or send who the current
 * user is. Live updates come from a Realtime subscription whose row filter is
 * backed by the same RLS policy.
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({ match, onMessageSent }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      try {
        const loaded = await api.getMessages(match.id);
        if (!active) return;
        setMessages(loaded);
        scrollToEnd('auto');
        await api.markMessagesRead(match.id);
        onMessageSent?.();
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  useEffect(() => {
    const unsubscribe = api.subscribeToMessages(match.id, (incoming) => {
      // The subscription only ever carries the partner's inserts that we did
      // not just make ourselves, so dedupe on id and append.
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      scrollToEnd();
      api.markMessagesRead(match.id);
    });

    return unsubscribe;
  }, [match.id, scrollToEnd]);

  const send = async () => {
    const body = draft.trim();
    if (!body || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const sent = await api.sendMessage(match.id, body);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setDraft('');
      scrollToEnd();
      onMessageSent?.();
    } catch (err: any) {
      setError(err?.message || 'Could not send that message.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  let lastDay = '';

  return (
    <div className="flex flex-col h-[min(60vh,28rem)] rounded-[var(--radius-card-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-[var(--color-stone-dark)]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-2">
            <p className="text-sm font-bold text-[var(--color-ink)]">
              You matched with {match.partnerProfile.name}.
            </p>
            <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed">
              Say something here first. You only need to share a phone number if and when
              you both want to.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const day = dayLabel(message.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;

            return (
              <React.Fragment key={message.id}>
                {showDay && (
                  <div className="flex justify-center py-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">
                      {day}
                    </span>
                  </div>
                )}

                <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                      message.isMine
                        ? 'bg-[var(--color-arrow-orange)] text-white rounded-br-md'
                        : 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border-subtle)] rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <span
                      className={`block text-[10px] mt-1 ${
                        message.isMine ? 'text-white/70' : 'text-[var(--color-stone-dark)]'
                      }`}
                    >
                      {timeLabel(message.createdAt)}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-2 bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs border-t border-[var(--color-border-subtle)]">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 flex items-end gap-2">
        <label htmlFor={`chat-${match.id}`} className="sr-only">
          Message {match.partnerProfile.name}
        </label>
        <textarea
          id={`chat-${match.id}`}
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={`Message ${match.partnerProfile.name}...`}
          className="flex-1 resize-none max-h-28 px-3 py-2.5 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-stone-dark)] focus:outline-none focus:border-[var(--color-arrow-orange)]"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || isSending}
          className="w-10 h-10 shrink-0 rounded-full bg-[var(--color-arrow-orange)] text-white flex items-center justify-center transition-all hover:bg-[var(--color-arrow-orange-hover)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          aria-label="Send message"
        >
          {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};
