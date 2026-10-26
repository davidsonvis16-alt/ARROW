import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { UserProfile } from '../../types';
import { Loader2, Star } from 'lucide-react';

interface SuperArrowModalProps {
  target: UserProfile | null;
  superRemaining: number;
  onClose: () => void;
  onSend: (note: string) => Promise<void>;
}

const MAX_NOTE = 140;

/**
 * A super arrow with an optional short note (Plus and Premium). It is the only
 * thing anyone can say before a match, so it is short, optional, and goes
 * through the same report-and-block tools as chat.
 */
export const SuperArrowModal: React.FC<SuperArrowModalProps> = ({ target, superRemaining, onClose, onSend }) => {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (target) setNote('');
  }, [target]);

  if (!target) return null;

  const send = async () => {
    setSending(true);
    try {
      await onSend(note.trim());
    } finally {
      setSending(false);
    }
  };

  const prompt = target.prompts?.find((p) => p.answer?.trim());

  return (
    <Modal isOpen={Boolean(target)} onClose={onClose} variant="bottomSheet" maxWidth="sm" title={`Super arrow to ${target.name}`} subtitle={`${superRemaining} left today · they'll see you first`}>
      <div className="space-y-4">
        {prompt && (
          <div className="p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
            <p className="text-[11px] font-bold text-[var(--color-forest)]">{prompt.question}</p>
            <p className="text-sm text-[var(--color-ink)]">{prompt.answer}</p>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="super-note" className="text-xs font-bold text-[var(--color-ink)]">
            Add a note <span className="font-normal text-[var(--color-stone-dark)]">(optional)</span>
          </label>
          <textarea
            id="super-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
            rows={3}
            placeholder={prompt ? 'React to their answer…' : 'Say what caught your eye…'}
            className="w-full resize-none px-3.5 py-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] sm:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-stone-dark)] focus:outline-none focus:border-[var(--color-forest)]"
          />
          <p className="text-right text-[10px] text-[var(--color-stone-dark)]">
            {note.length}/{MAX_NOTE}
          </p>
        </div>

        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="w-full py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-forest)] text-[var(--color-offwhite)] text-sm font-black flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-60 hover:brightness-110"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
          Send super arrow
        </button>
      </div>
    </Modal>
  );
};
