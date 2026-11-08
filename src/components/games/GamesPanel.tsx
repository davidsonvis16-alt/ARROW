import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AskAnswer,
  GameKind,
  GamePack,
  GameRound,
  MatchWithProfile,
  PickAnswer,
  TruthsAnswer,
  TruthsSetup,
} from '../../types';
import { api } from '../../services/api';
import { isUpgradeError } from '../../services/rpc';
import { secureService } from '../../services/secureService';
import { useSecure } from '../secure/SecureChat';
import { Check, Crown, HelpCircle, Loader2, Lock, MessagesSquare, Shuffle, Sparkles, X } from 'lucide-react';

export const GAME_PACKS: Array<{ id: GamePack; name: string; blurb: string; paid: boolean }> = [
  { id: 'starter', name: 'Starter', blurb: 'Light, fun, first-date questions', paid: false },
  { id: 'deep', name: 'Deep Talk', blurb: 'Values, love and what matters', paid: true },
  { id: 'future', name: 'Future Us', blurb: 'Home, family and dreams', paid: true },
];

const GAMES: Array<{ kind: GameKind; name: string; blurb: string; icon: React.ReactNode }> = [
  { kind: 'pick', name: 'This or That', blurb: 'Both pick, then see if you agree', icon: <Shuffle size={16} /> },
  { kind: 'ask', name: 'Get to Know You', blurb: 'Both answer the same question', icon: <MessagesSquare size={16} /> },
  { kind: 'truths', name: 'Two Truths & a Lie', blurb: 'Can they spot the lie?', icon: <HelpCircle size={16} /> },
];

const POLL_MS = 10_000;

type AnyAnswer = Partial<PickAnswer & AskAnswer & TruthsAnswer>;

interface Opened {
  mine: AnyAnswer | null;
  theirs: AnyAnswer | null;
  setup: TruthsSetup | null;
  error?: string;
  /** Which answers existed when this was opened, to know when to reopen. */
  stamp: string;
}

/** Rounds where it is your turn. Used for the badge on the Play tab. */
export function roundsWaitingOnMe(rounds: GameRound[]): number {
  return rounds.filter((r) => !r.myAnswer).length;
}

/**
 * Date games for one match. Everything you type or pick is encrypted on this
 * phone, and the server will not show either of you the other's answer until
 * you have both played — so a round is a real "on three…" moment.
 */
export const GamesPanel: React.FC<{
  match: MatchWithProfile;
  canUsePacks: boolean;
  onUpgrade?: () => void;
}> = ({ match, canUsePacks, onUpgrade }) => {
  const partner = match.partnerProfile;
  const { status, requireSecure } = useSecure();
  const [rounds, setRounds] = useState<GameRound[]>([]);
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const [loading, setLoading] = useState(true);
  const [pack, setPack] = useState<GamePack>('starter');
  const [starting, setStarting] = useState<GameKind | null>(null);
  const [composingTruths, setComposingTruths] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api.getGames(match.id);
    setRounds(list);
    setLoading(false);
  }, [match.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Open whatever is newly visible. A round's content only changes when an
  // answer arrives, so the cache key includes which answers exist.
  useEffect(() => {
    let active = true;
    if (status !== 'ready') return;
    const stamp = (r: GameRound) => `${r.id}:${Boolean(r.myAnswer)}:${Boolean(r.theirAnswer)}`;

    Promise.all(
      rounds
        .filter((r) => opened[r.id]?.stamp !== stamp(r))
        .map(async (r) => {
          try {
            const [mine, theirs, setup] = await Promise.all([
              secureService.openJson<AnyAnswer>(partner.id, r.myAnswer),
              secureService.openJson<AnyAnswer>(partner.id, r.theirAnswer),
              secureService.openJson<TruthsSetup>(partner.id, r.setup),
            ]);
            return [r.id, { mine, theirs, setup, stamp: stamp(r) }] as const;
          } catch (err) {
            return [r.id, { mine: null, theirs: null, setup: null, error: (err as Error).message, stamp: stamp(r) }] as const;
          }
        })
    ).then((pairs) => {
      if (active && pairs.length) setOpened((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds, status, partner.id]);

  const upsert = (round: GameRound) =>
    setRounds((prev) => [round, ...prev.filter((r) => r.id !== round.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  const fail = (err: unknown) => {
    if (isUpgradeError(err) && (err as Error).message.includes('Plus')) onUpgrade?.();
    setError((err as Error)?.message || 'Something went wrong.');
  };

  const start = async (kind: GameKind) => {
    setError(null);
    if (kind === 'truths') {
      setComposingTruths(true);
      return;
    }
    if (!(await requireSecure('Game answers are end-to-end encrypted.'))) return;
    setStarting(kind);
    try {
      upsert(await api.startGame(match.id, kind, pack));
    } catch (err) {
      fail(err);
    } finally {
      setStarting(null);
    }
  };

  const answer = async (round: GameRound, payload: object) => {
    setError(null);
    if (!(await requireSecure('Game answers are end-to-end encrypted.'))) return;
    try {
      upsert(await api.answerGame(round.id, partner.id, payload));
    } catch (err) {
      fail(err);
    }
  };

  const sync = useMemo(() => {
    let both = 0;
    let same = 0;
    for (const r of rounds) {
      const o = opened[r.id];
      if (r.kind !== 'pick' || !o?.mine || !o?.theirs) continue;
      both++;
      if (o.mine.choice === o.theirs.choice) same++;
    }
    return { both, same };
  }, [rounds, opened]);

  return (
    <div className="space-y-4">
      {sync.both > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--color-arrow-orange-subtle)] border border-[var(--color-border-subtle)]">
          <Sparkles size={18} className="shrink-0 text-[var(--color-arrow-orange-text)]" />
          <div>
            <p className="text-sm font-black text-[var(--color-ink)]">
              In sync on {sync.same} of {sync.both}
            </p>
            <p className="text-[11px] text-[var(--color-stone-dark)]">
              How often you and {partner.name} picked the same in This or That
            </p>
          </div>
        </div>
      )}

      {/* Pack */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">Question pack</p>
        <div className="grid grid-cols-3 gap-1.5">
          {GAME_PACKS.map((p) => {
            const locked = p.paid && !canUsePacks;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => (locked ? onUpgrade?.() : setPack(p.id))}
                aria-pressed={pack === p.id}
                className={`text-left p-2.5 rounded-xl border transition-colors ${
                  pack === p.id
                    ? 'border-[var(--color-ink)] bg-[var(--color-surface)]'
                    : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface)]'
                }`}
              >
                <span className="flex items-center gap-1 text-xs font-bold text-[var(--color-ink)]">
                  {p.name}
                  {locked && <Crown size={11} className="text-[var(--color-arrow-orange-text)]" />}
                </span>
                <span className="block text-[10px] leading-tight text-[var(--color-stone-dark)]">
                  {locked ? 'With Plus' : p.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Games */}
      <div className="grid gap-2">
        {GAMES.map((g) => (
          <button
            key={g.kind}
            type="button"
            onClick={() => start(g.kind)}
            disabled={starting !== null}
            className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left hover:border-[var(--color-arrow-orange)] transition-colors disabled:opacity-60"
          >
            <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-[var(--color-stone-light)] text-[var(--color-ink)]">
              {starting === g.kind ? <Loader2 size={16} className="animate-spin" /> : g.icon}
            </span>
            <span>
              <span className="block text-sm font-bold text-[var(--color-ink)]">{g.name}</span>
              <span className="block text-[11px] text-[var(--color-stone-dark)]">
                {g.kind === 'truths' ? g.blurb : `${g.blurb} · ${GAME_PACKS.find((p) => p.id === pack)?.name}`}
              </span>
            </span>
          </button>
        ))}
      </div>

      {composingTruths && (
        <TruthsComposer
          partnerName={partner.name}
          onCancel={() => setComposingTruths(false)}
          onSend={async (statements, lie) => {
            if (!(await requireSecure('Game answers are end-to-end encrypted.'))) return;
            try {
              upsert(await api.startTruths(match.id, partner.id, statements, lie));
              setComposingTruths(false);
            } catch (err) {
              fail(err);
            }
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-[var(--color-danger-text)]">
          {error}
        </p>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-[var(--color-stone-dark)] leading-relaxed">
        <Lock size={12} className="shrink-0 mt-px text-[var(--color-forest)]" />
        Answers are end-to-end encrypted and stay hidden from both of you until you have both played.
      </p>

      {/* Rounds */}
      {loading ? (
        <div className="flex justify-center py-6 text-[var(--color-stone-dark)]">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : rounds.length === 0 ? (
        <p className="text-center text-xs text-[var(--color-stone-dark)] py-4">
          No rounds yet. Pick a game above — {partner.name} will see it here.
        </p>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              opened={opened[round.id]}
              partnerName={partner.name}
              locked={status !== 'ready'}
              onAnswer={(payload) => answer(round, payload)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const optionClass = (selected: boolean) =>
  `w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${
    selected
      ? 'border-[var(--color-arrow-orange)] bg-[var(--color-arrow-orange-subtle)] text-[var(--color-ink)] font-bold'
      : 'border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-arrow-orange)]'
  }`;

const RoundCard: React.FC<{
  round: GameRound;
  opened?: Opened;
  partnerName: string;
  locked: boolean;
  onAnswer: (payload: object) => Promise<void>;
}> = ({ round, opened, partnerName, locked, onAnswer }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (payload: object) => {
    setBusy(true);
    try {
      await onAnswer(payload);
    } finally {
      setBusy(false);
    }
  };

  const title = GAMES.find((g) => g.kind === round.kind)?.name;
  const answered = Boolean(round.myAnswer);
  const waiting = answered && !round.theirAnswer;
  const mine = opened?.mine;
  const theirs = opened?.theirs;

  let body: React.ReactNode;

  if (locked && (round.myAnswer || round.setup)) {
    body = <p className="text-xs italic text-[var(--color-stone-dark)]">Unlock secure chat to see this round.</p>;
  } else if (opened?.error) {
    body = <p className="text-xs italic text-[var(--color-stone-dark)]">{opened.error}</p>;
  } else if (round.kind === 'pick') {
    body = (
      <div className="space-y-2">
        <p className="text-sm font-bold text-[var(--color-ink)]">{round.prompt}</p>
        {round.options.map((option, i) => {
          const isMine = mine?.choice === i;
          const isTheirs = theirs?.choice === i;
          return (
            <button
              key={i}
              type="button"
              disabled={answered || busy}
              onClick={() => submit({ choice: i })}
              className={optionClass(isMine)}
            >
              <span className="flex items-center justify-between gap-2">
                {option}
                <span className="flex gap-1 text-[10px] font-bold uppercase tracking-wider">
                  {isMine && <span className="text-[var(--color-arrow-orange-text)]">You</span>}
                  {isTheirs && <span className="text-[var(--color-forest)]">{partnerName}</span>}
                </span>
              </span>
            </button>
          );
        })}
        {mine && theirs && (
          <p className="text-xs font-bold text-[var(--color-ink)]">
            {mine.choice === theirs.choice ? 'Same pick!' : 'Different picks — ask them why.'}
          </p>
        )}
      </div>
    );
  } else if (round.kind === 'ask') {
    body = (
      <div className="space-y-2">
        <p className="text-sm font-bold text-[var(--color-ink)]">{round.prompt}</p>
        {answered ? (
          <>
            <Answer label="You" text={mine?.text} />
            {theirs && <Answer label={partnerName} text={theirs.text} />}
          </>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Your answer…"
              className="w-full resize-none px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] sm:text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-arrow-orange)]"
            />
            <button
              type="button"
              disabled={!text.trim() || busy}
              onClick={() => submit({ text: text.trim() })}
              className="w-full py-2.5 rounded-xl bg-[var(--color-arrow-orange)] text-white text-xs font-black disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Answer'}
            </button>
          </>
        )}
      </div>
    );
  } else {
    // Two truths and a lie. The starter's sealed answer is which one is the lie.
    const statements = opened?.setup?.statements ?? [];
    const lie = round.startedByMe ? mine?.lie : theirs?.lie;
    const guess = round.startedByMe ? theirs?.guess : mine?.guess;
    const revealed = lie !== undefined && guess !== undefined;

    body = (
      <div className="space-y-2">
        <p className="text-sm font-bold text-[var(--color-ink)]">
          {round.startedByMe ? `Can ${partnerName} spot your lie?` : `Which one is ${partnerName}'s lie?`}
        </p>
        {statements.map((statement, i) => (
          <button
            key={i}
            type="button"
            disabled={round.startedByMe || answered || busy}
            onClick={() => submit({ guess: i })}
            className={optionClass(guess === i)}
          >
            <span className="flex items-center justify-between gap-2">
              {statement}
              {(round.startedByMe || revealed) && lie === i && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-danger-text)]">Lie</span>
              )}
            </span>
          </button>
        ))}
        {revealed && (
          <p className="flex items-center gap-1 text-xs font-bold text-[var(--color-ink)]">
            {guess === lie ? <Check size={13} className="text-[var(--color-forest)]" /> : <X size={13} />}
            {round.startedByMe
              ? guess === lie
                ? `${partnerName} spotted it.`
                : `${partnerName} was fooled.`
              : guess === lie
                ? 'You spotted it!'
                : 'Fooled you.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-stone-dark)]">
          {title}
          {round.pack !== 'starter' && ` · ${GAME_PACKS.find((p) => p.id === round.pack)?.name}`}
        </span>
        <span className="text-[10px] font-semibold text-[var(--color-stone-dark)]">
          {!answered
            ? round.theyAnswered
              ? `${partnerName} answered — your turn`
              : 'Your turn'
            : waiting
              ? `Waiting for ${partnerName}`
              : 'Revealed'}
        </span>
      </div>
      {body}
    </div>
  );
};

const Answer: React.FC<{ label: string; text?: string }> = ({ label, text }) => (
  <div className="px-3.5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-stone-dark)]">{label}</p>
    <p className="text-sm text-[var(--color-ink)] whitespace-pre-line">{text ?? '…'}</p>
  </div>
);

const TruthsComposer: React.FC<{
  partnerName: string;
  onCancel: () => void;
  onSend: (statements: string[], lie: number) => Promise<void>;
}> = ({ partnerName, onCancel, onSend }) => {
  const [statements, setStatements] = useState(['', '', '']);
  const [lie, setLie] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = statements.every((s) => s.trim()) && lie !== null;

  return (
    <div className="p-3.5 rounded-2xl border border-[var(--color-arrow-orange)] bg-[var(--color-surface)] space-y-2.5">
      <p className="text-sm font-bold text-[var(--color-ink)]">Write two truths and one lie</p>
      <p className="text-[11px] text-[var(--color-stone-dark)]">Tap the circle next to the lie. {partnerName} has to guess it.</p>
      {statements.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name="truths-lie"
            checked={lie === i}
            onChange={() => setLie(i)}
            aria-label={`Statement ${i + 1} is the lie`}
            className="w-4 h-4 accent-[var(--color-arrow-orange)]"
          />
          <input
            type="text"
            maxLength={120}
            value={value}
            onChange={(e) => setStatements(statements.map((s, j) => (j === i ? e.target.value : s)))}
            placeholder={`Statement ${i + 1}`}
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-[16px] sm:text-xs text-[var(--color-ink)]"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-ink)]">
          Cancel
        </button>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSend(statements.map((s) => s.trim()), lie as number);
            } finally {
              setBusy(false);
            }
          }}
          className="flex-1 py-2.5 rounded-xl bg-[var(--color-arrow-orange)] text-white text-xs font-black disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
};
