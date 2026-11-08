import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { AskFirstAnswer, UserProfile } from '../../types';
import { Loader2, Lock, Send } from 'lucide-react';

interface AskFirstModalProps {
  target: UserProfile | null;
  isSuper?: boolean;
  onClose: () => void;
  onSend: (answers: AskFirstAnswer[]) => Promise<void>;
}

const MAX_ANSWER = 300;

/**
 * Someone asked these before they hear from you. Answering is what sends the
 * spark; the answers are encrypted on this phone so only they can read them.
 */
export const AskFirstModal: React.FC<AskFirstModalProps> = ({ target, isSuper, onClose, onSend }) => {
  const [answers, setAnswers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const questions = target?.askFirst ?? [];

  useEffect(() => {
    if (target) setAnswers((target.askFirst ?? []).map(() => ''));
  }, [target]);

  if (!target) return null;

  const ready = questions.length > 0 && answers.length === questions.length && answers.every((a) => a.trim());

  const send = async () => {
    if (!ready) return;
    setSending(true);
    try {
      await onSend(questions.map((q, i) => ({ q, a: answers[i].trim() })));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="sm"
      title={`${target.name} asks first`}
      subtitle={isSuper ? 'Answer to send your super spark' : 'Answer to send your spark'}
    >
      <div className="space-y-4">
        {questions.map((question, i) => (
          <div key={i} className="space-y-1">
            <label htmlFor={`ask-${i}`} className="text-xs font-bold text-[var(--color-ink)]">
              {question}
            </label>
            <textarea
              id={`ask-${i}`}
              value={answers[i] ?? ''}
              onChange={(e) =>
                setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value.slice(0, MAX_ANSWER) : a)))
              }
              rows={2}
              autoFocus={i === 0}
              placeholder="Your answer…"
              className="w-full resize-none px-3.5 py-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] sm:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-stone-dark)] focus:outline-none focus:border-[var(--color-forest)]"
            />
            <p className="text-right text-[10px] text-[var(--color-stone-dark)]">
              {(answers[i] ?? '').length}/{MAX_ANSWER}
            </p>
          </div>
        ))}

        <p className="flex items-start gap-1.5 text-[11px] text-[var(--color-stone-dark)] leading-relaxed">
          <Lock size={12} className="shrink-0 mt-px text-[var(--color-forest)]" />
          Encrypted on your phone. Only {target.name} can read your answers.
        </p>

        <button
          type="button"
          onClick={send}
          disabled={!ready || sending}
          className="w-full py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-arrow-orange)] text-white text-sm font-black flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50 hover:bg-[var(--color-arrow-orange-hover)]"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Send answers and spark
        </button>
      </div>
    </Modal>
  );
};
