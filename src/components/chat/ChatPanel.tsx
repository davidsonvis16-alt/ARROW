import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatMessage, MatchWithProfile, MESSAGE_REACTIONS, MessageReaction } from '../../types';
import { api } from '../../services/api';
import { Send, Loader2, ShieldAlert, SmilePlus, CheckCheck, Sparkles } from 'lucide-react';

interface ChatPanelProps {
  match: MatchWithProfile;
  currentUserId: string | null;
  /** Premium: the server includes when the partner read your messages. */
  hasReadReceipts?: boolean;
  onMessageSent?: () => void;
  onUpgrade?: () => void;
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
 * Conversation openers drawn from what the partner actually wrote, so the
 * first message can be about them rather than "hey". Nothing here is invented:
 * with no prompts or interests there are simply fewer suggestions.
 */
function openersFor(match: MatchWithProfile): string[] {
  const p = match.partnerProfile;
  const ideas: string[] = [];

  const prompt = p.prompts?.find((pr) => pr.answer?.trim());
  if (prompt) ideas.push(`"${prompt.answer.trim().slice(0, 60)}" — tell me more about that.`);
  if (p.interests?.[0]) ideas.push(`You're into ${p.interests[0].toLowerCase()} — how did that start?`);
  if (p.interests?.[1]) ideas.push(`${p.interests[1]} or ${p.interests[0] ?? 'coffee'}: which wins your weekend?`);
  if (p.location) ideas.push(`What's your favourite spot in ${p.location}?`);
  ideas.push(`Hi ${p.name}! What made you swipe right?`);

  return ideas.slice(0, 3);
}

const TYPING_IDLE_MS = 3000;
const TYPING_RESEND_MS = 2000;

/**
 * Conversation with a match.
 *
 * Everything here is addressed by match id and the server proves membership on
 * every call, so this component never sends who the current user is — it only
 * uses the id locally to tell its own live messages from the partner's.
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  match,
  currentUserId,
  hasReadReceipts = false,
  onMessageSent,
  onUpgrade,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef<(typing: boolean) => void>(() => undefined);
  const lastTypingSent = useRef(0);
  const typingIdle = useRef<number | undefined>(undefined);
  const partnerTypingTimer = useRef<number | undefined>(undefined);

  const partnerName = match.partnerProfile.name;
  const openers = useMemo(() => openersFor(match), [match]);

  const scrollToEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, []);

  const reload = useCallback(async () => {
    const loaded = await api.getMessages(match.id);
    setMessages(loaded);
  }, [match.id]);

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
    const live = api.subscribeToChat(match.id, currentUserId, {
      onMessage: (incoming) => {
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        if (!incoming.isMine) {
          setPartnerTyping(false);
          api.markMessagesRead(match.id);
        }
        scrollToEnd();
      },
      onReaction: (id, reaction) =>
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, reaction } : m))),
      // Only Premium gets receipts back from the server, so only refetch then.
      onRead: hasReadReceipts ? reload : undefined,
      onTyping: (isTyping) => {
        setPartnerTyping(isTyping);
        window.clearTimeout(partnerTypingTimer.current);
        // Never leave "typing…" stuck if the stop event is lost.
        if (isTyping) {
          partnerTypingTimer.current = window.setTimeout(() => setPartnerTyping(false), TYPING_IDLE_MS + 2000);
        }
      },
    });
    typingRef.current = live.setTyping;

    return () => {
      typingRef.current(false);
      live.unsubscribe();
      window.clearTimeout(typingIdle.current);
      window.clearTimeout(partnerTypingTimer.current);
    };
  }, [match.id, currentUserId, hasReadReceipts, reload, scrollToEnd]);

  useEffect(() => {
    if (partnerTyping) scrollToEnd();
  }, [partnerTyping, scrollToEnd]);

  const announceTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_RESEND_MS) {
      typingRef.current(true);
      lastTypingSent.current = now;
    }
    window.clearTimeout(typingIdle.current);
    typingIdle.current = window.setTimeout(() => {
      typingRef.current(false);
      lastTypingSent.current = 0;
    }, TYPING_IDLE_MS);
  };

  const send = async (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body || isSending) return;

    setIsSending(true);
    setError(null);
    window.clearTimeout(typingIdle.current);
    typingRef.current(false);
    lastTypingSent.current = 0;

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

  const react = async (message: ChatMessage, reaction: MessageReaction) => {
    const next = message.reaction === reaction ? null : reaction;
    setPickerFor(null);
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reaction: next } : m)));
    try {
      await api.reactToMessage(message.id, next);
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reaction: message.reaction } : m)));
      setError(err?.message || 'Could not add that reaction.');
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  // Grow the box with its content, up to a few lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [draft]);

  const lastMine = [...messages].reverse().find((m) => m.isMine);
  let lastDay = '';

  return (
    <div className="flex flex-col h-[min(62dvh,32rem)] rounded-[var(--radius-card-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-1.5"
        onClick={() => setPickerFor(null)}
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-[var(--color-stone-dark)]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-3 space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-[var(--color-ink)]">You matched with {partnerName}.</p>
              <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed">
                Say something here first. You only share a phone number if and when you both want to.
              </p>
            </div>
            <div className="w-full space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)] flex items-center justify-center gap-1">
                <Sparkles size={11} className="text-[var(--color-arrow-orange-text)]" />
                Openers based on their profile
              </p>
              {openers.map((line) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => {
                    setDraft(line);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left text-xs px-3.5 py-2.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-[var(--color-ink)] hover:border-[var(--color-arrow-orange)] transition-colors"
                >
                  {line}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const day = dayLabel(message.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const isLastMine = message.id === lastMine?.id;

            return (
              <React.Fragment key={message.id}>
                {showDay && (
                  <div className="flex justify-center py-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">
                      {day}
                    </span>
                  </div>
                )}

                <div className={`group flex items-end gap-1.5 ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`relative max-w-[80%] ${message.reaction ? 'mb-3' : ''}`}>
                    <div
                      className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                        message.isMine
                          ? 'bg-[var(--color-arrow-orange)] text-white rounded-br-md'
                          : 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border-subtle)] rounded-bl-md'
                      }`}
                      onDoubleClick={() => !message.isMine && react(message, '❤️')}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <span
                        className={`block text-[10px] mt-0.5 ${
                          message.isMine ? 'text-white/75' : 'text-[var(--color-stone-dark)]'
                        }`}
                      >
                        {timeLabel(message.createdAt)}
                      </span>
                    </div>

                    {message.reaction && (
                      <span
                        className={`absolute -bottom-3 ${
                          message.isMine ? 'left-1' : 'right-1'
                        } text-xs leading-none px-1.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-subtle)]`}
                        aria-label={`Reaction ${message.reaction}`}
                      >
                        {message.reaction}
                      </span>
                    )}

                    {pickerFor === message.id && (
                      <div
                        className="absolute z-10 bottom-full mb-1.5 left-0 flex gap-0.5 p-1 rounded-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] shadow-[var(--shadow-card)]"
                        onClick={(e) => e.stopPropagation()}
                        role="menu"
                      >
                        {MESSAGE_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            role="menuitem"
                            onClick={() => react(message, emoji)}
                            className={`w-9 h-9 rounded-full text-lg flex items-center justify-center transition-transform active:scale-90 ${
                              message.reaction === emoji ? 'bg-[var(--color-arrow-orange-subtle)]' : 'hover:bg-[var(--color-stone-light)]'
                            }`}
                            aria-label={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!message.isMine && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPickerFor((cur) => (cur === message.id ? null : message.id));
                      }}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-stone-dark)] hover:text-[var(--color-ink)] hover:bg-[var(--color-stone-light)] sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label="React to this message"
                    >
                      <SmilePlus size={15} />
                    </button>
                  )}
                </div>

                {isLastMine && (
                  <div className="flex justify-end pr-1">
                    {message.readAt ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-forest)]">
                        <CheckCheck size={12} />
                        Read {timeLabel(message.readAt)}
                      </span>
                    ) : !hasReadReceipts && onUpgrade ? (
                      <button
                        type="button"
                        onClick={onUpgrade}
                        className="text-[10px] font-semibold text-[var(--color-stone-dark)] hover:text-[var(--color-arrow-orange-text)]"
                      >
                        Sent · See when it's read with Premium
                      </button>
                    ) : (
                      <span className="text-[10px] text-[var(--color-stone-dark)]">Sent</span>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}

        {partnerTyping && (
          <div className="flex justify-start" aria-live="polite">
            <div className="px-3.5 py-3 rounded-2xl rounded-bl-md bg-[var(--color-surface)] border border-[var(--color-border-subtle)] flex items-center gap-1">
              <span className="sr-only">{partnerName} is typing</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-stone-dark)] animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-2 bg-[var(--color-danger-subtle)] text-[var(--color-danger-text)] text-xs border-t border-[var(--color-border-subtle)]">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 flex items-end gap-2">
        <label htmlFor={`chat-${match.id}`} className="sr-only">
          Message {partnerName}
        </label>
        <textarea
          id={`chat-${match.id}`}
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value.slice(0, 2000));
            if (e.target.value.trim()) announceTyping();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          enterKeyHint="send"
          placeholder={`Message ${partnerName}…`}
          className="flex-1 resize-none max-h-28 px-3.5 py-2.5 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[16px] sm:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-stone-dark)] focus:outline-none focus:border-[var(--color-arrow-orange)]"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={!draft.trim() || isSending}
          className="w-11 h-11 shrink-0 rounded-full bg-[var(--color-arrow-orange)] text-white flex items-center justify-center transition-all hover:bg-[var(--color-arrow-orange-hover)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          aria-label="Send message"
        >
          {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};
