import React, { useEffect, useState } from 'react';
import { AskFirstAnswer, MatchWithProfile } from '../../types';
import { secureService } from '../../services/secureService';
import { useSecureStatus } from '../secure/SecureChat';
import { ChevronDown, MessageSquareQuote } from 'lucide-react';

/** Decrypt an "ask me first" answers envelope. Null while locked or absent. */
export function useAnswers(partnerId: string | undefined, sealed: string | null | undefined): AskFirstAnswer[] | null {
  const status = useSecureStatus();
  const [answers, setAnswers] = useState<AskFirstAnswer[] | null>(null);

  useEffect(() => {
    let active = true;
    setAnswers(null);
    if (!partnerId || !sealed || status !== 'ready') return;
    secureService
      .openJson<AskFirstAnswer[]>(partnerId, sealed)
      .then((list) => active && setAnswers(Array.isArray(list) ? list : null))
      .catch(() => active && setAnswers(null));
    return () => {
      active = false;
    };
  }, [partnerId, sealed, status]);

  return answers;
}

export const AnswerList: React.FC<{ answers: AskFirstAnswer[] }> = ({ answers }) => (
  <div className="space-y-2">
    {answers.map((item, i) => (
      <div key={i} className="space-y-0.5">
        <p className="text-[11px] font-bold text-[var(--color-forest)]">{item.q}</p>
        <p className="text-xs text-[var(--color-ink)] leading-relaxed whitespace-pre-line">{item.a}</p>
      </div>
    ))}
  </div>
);

/**
 * At the top of a conversation: what each of you answered to the other's
 * "ask me first" questions. A ready-made thing to talk about.
 */
export const AnswersCard: React.FC<{ match: MatchWithProfile }> = ({ match }) => {
  const partner = match.partnerProfile;
  const theirs = useAnswers(partner.id, match.theirAnswers);
  const mine = useAnswers(partner.id, match.myAnswers);
  const [open, setOpen] = useState(true);

  if (!theirs?.length && !mine?.length) return null;

  return (
    <div className="mb-2 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink)]">
          <MessageSquareQuote size={14} className="text-[var(--color-arrow-orange-text)]" />
          How you answered each other
        </span>
        <ChevronDown size={14} className={`text-[var(--color-stone-dark)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-3 space-y-3">
          {theirs?.length ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">
                {partner.name} answered your questions
              </p>
              <AnswerList answers={theirs} />
            </div>
          ) : null}
          {mine?.length ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">
                You answered {partner.name}'s
              </p>
              <AnswerList answers={mine} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

/** Answers someone sent with their spark, opened on this device. */
export const ReceivedAnswers: React.FC<{ partnerId: string; partnerName: string; sealed?: string | null }> = ({
  partnerId,
  partnerName,
  sealed,
}) => {
  const status = useSecureStatus();
  const answers = useAnswers(partnerId, sealed);
  if (!sealed) return null;

  return (
    <div className="p-3 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">
        <MessageSquareQuote size={12} className="text-[var(--color-arrow-orange-text)]" />
        {partnerName} answered your questions
      </p>
      {answers ? (
        <AnswerList answers={answers} />
      ) : (
        <p className="text-xs italic text-[var(--color-stone-dark)]">
          {status === 'ready' ? 'Opening…' : 'Unlock secure chat to read their answers.'}
        </p>
      )}
    </div>
  );
};
