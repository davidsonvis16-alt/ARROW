import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { secureService } from '../../services/secureService';
import { useSecure } from './SecureChat';
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';

/**
 * The strip at the top of a conversation: that it is end-to-end encrypted, the
 * security code to compare in person, and anything that needs attention — this
 * device is locked, they have not set up secure chat yet, or their key changed.
 */
export const SecurityBar: React.FC<{ partner: UserProfile }> = ({ partner }) => {
  const { status, requireSecure } = useSecure();
  const [code, setCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [keyChanged, setKeyChanged] = useState(false);

  useEffect(() => {
    let active = true;
    setCode(null);
    setKeyChanged(false);
    if (status !== 'ready') return;
    secureService.securityCodeWith(partner.id).then((c) => active && setCode(c));
    secureService.partnerKeyChanged(partner.id).then((changed) => active && setKeyChanged(changed));
    return () => {
      active = false;
    };
  }, [partner.id, status]);

  if (status === 'unavailable') return null;

  if (status !== 'ready') {
    return (
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border-subtle)] text-[11px]">
        <span className="flex items-center gap-1.5 text-[var(--color-stone-dark)]">
          <Lock size={12} className="text-[var(--color-forest)]" />
          {status === 'locked' ? 'Unlock secure chat on this device to read and reply' : 'Turn on secure chat to message'}
        </span>
        <button
          type="button"
          onClick={() => requireSecure()}
          className="shrink-0 font-bold text-[var(--color-forest)] hover:underline"
        >
          {status === 'locked' ? 'Unlock' : 'Turn on'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] border-b border-[var(--color-border-subtle)] text-[11px]">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2">
        <span className="flex items-center gap-1.5 text-[var(--color-stone-dark)]">
          <ShieldCheck size={12} className="text-[var(--color-forest)]" />
          {partner.secureChat === false
            ? `Secure chat starts once ${partner.name} next opens Finderr`
            : 'End-to-end encrypted. Only you two can read this.'}
        </span>
        {code && (
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="shrink-0 font-bold text-[var(--color-forest)] hover:underline"
            aria-expanded={showCode}
          >
            {showCode ? 'Hide code' : 'Security code'}
          </button>
        )}
      </div>

      {showCode && code && (
        <div className="px-3.5 pb-2.5 space-y-1">
          <p className="font-mono text-sm tracking-wider text-[var(--color-ink)]">{code}</p>
          <p className="text-[var(--color-stone-dark)] leading-relaxed">
            When you meet, check {partner.name} sees the same numbers. If they match, nobody is sitting in the middle
            of your conversation.
          </p>
        </div>
      )}

      {keyChanged && (
        <div className="flex items-start justify-between gap-2 px-3.5 py-2 bg-[var(--color-warning-subtle)] border-t border-[var(--color-border-subtle)]">
          <span className="flex items-start gap-1.5 text-[var(--color-ink)]">
            <AlertTriangle size={12} className="shrink-0 mt-px text-[var(--color-arrow-orange-text)]" />
            {partner.name} reset secure chat, so their security code changed. That is normal after a new phone or a
            forgotten passcode — if in doubt, compare codes again.
          </span>
          <button
            type="button"
            onClick={() => {
              secureService.acknowledgePartnerKey(partner.id);
              setKeyChanged(false);
            }}
            className="shrink-0 font-bold text-[var(--color-forest)] hover:underline"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
};
