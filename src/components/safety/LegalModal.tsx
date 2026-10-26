import React from 'react';
import { Modal } from '../ui/Modal';
import { GUIDELINES, LEGAL_CONTACT, LegalDocument, PRIVACY, SAFETY, TERMS } from '../../content/legal';
import { CreatedByEden } from '../brand/Logo';

export type LegalDocType = 'privacy' | 'terms' | 'safety' | 'guidelines';

interface LegalModalProps {
  type: LegalDocType | null;
  isOpen: boolean;
  onClose: () => void;
}

const DOCS: Record<LegalDocType, LegalDocument> = {
  terms: TERMS,
  privacy: PRIVACY,
  safety: SAFETY,
  guidelines: GUIDELINES,
};

export const LegalModal: React.FC<LegalModalProps> = ({ type, isOpen, onClose }) => {
  if (!type) return null;
  const doc = DOCS[type];
  const isLegal = type === 'terms' || type === 'privacy';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="lg"
      title={doc.title}
      subtitle={isLegal ? `Last updated ${LEGAL_CONTACT.lastUpdated}` : undefined}
    >
      <article className="space-y-5 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
        <p className="text-sm text-[var(--color-ink)]">{doc.intro}</p>

        {doc.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h4 className="text-sm font-black tracking-tight text-[var(--color-ink)]">{section.heading}</h4>
            {section.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.bullets && (
              <ul className="space-y-1.5 pl-4 list-disc marker:text-[var(--color-arrow-orange)]">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <CreatedByEden className="pt-3 border-t border-[var(--color-border-subtle)]" />
      </article>
    </Modal>
  );
};
