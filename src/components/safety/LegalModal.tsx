import React from 'react';
import { Modal } from '../ui/Modal';
import { ShieldCheck, FileText, Lock } from 'lucide-react';

export type LegalDocType = 'privacy' | 'terms' | 'safety';

interface LegalModalProps {
  type: LegalDocType | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  type,
  isOpen,
  onClose,
}) => {
  if (!type) return null;

  let title = 'Privacy Policy';
  let subtitle = 'How ARROW handles your information';
  let icon = <Lock size={18} className="text-[#17352F]" />;

  if (type === 'terms') {
    title = 'Terms of Service';
    subtitle = 'Community agreements and platform rules';
    icon = <FileText size={18} className="text-[#111111]" />;
  } else if (type === 'safety') {
    title = 'Safety Guidelines';
    subtitle = 'Protecting yourself and others on ARROW';
    icon = <ShieldCheck size={18} className="text-[#E85D2A]" />;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title={title}
      subtitle={subtitle}
    >
      <div className="space-y-4 text-xs text-[#222222] leading-relaxed pb-4">
        {type === 'safety' && (
          <div className="space-y-3">
            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">1. Strictly 18+ Community</h4>
              <p className="text-[#7A766E]">
                ARROW is exclusively for verified adults aged 18 and older. Any accounts found to belong to minors are immediately suspended.
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">2. Meet in Public Spaces</h4>
              <p className="text-[#7A766E]">
                Always arrange initial meetings in populated public places (such as a café or gallery). Let a trusted friend or family member know your plans.
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">3. Protect Financial & Sensitive Data</h4>
              <p className="text-[#7A766E]">
                Never send money, cryptocurrency, or wire transfers to anyone you meet online. Report any user asking for financial assistance immediately.
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">4. Zero Tolerance for Harassment</h4>
              <p className="text-[#7A766E]">
                Unsolicited sexually explicit material, abusive language, or threatening behavior results in permanent removal.
              </p>
            </div>
          </div>
        )}

        {type === 'privacy' && (
          <div className="space-y-3">
            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">1. Data Minimization</h4>
              <p className="text-[#7A766E]">
                We only collect data essential for the dating discovery experience: your name, verified age from birth date, photos, interests, and general location.
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">2. WhatsApp Privacy Architecture</h4>
              <p className="text-[#7A766E]">
                Your phone number is never publicly displayed on Discover, profiles, or search cards. Mutual match connections only bridge when both parties consent.
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">3. Permanent Account Deletion</h4>
              <p className="text-[#7A766E]">
                You have the full right to delete your account at any time. Permanent deletion removes your profile, photos, likes, matches, and conversation references.
              </p>
            </div>
          </div>
        )}

        {type === 'terms' && (
          <div className="space-y-3">
            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">1. Agreement to Terms</h4>
              <p className="text-[#7A766E]">
                By using ARROW, you represent that you are at least 18 years of age and agree to abide by our authentic community standards.
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">2. Authentic Representation</h4>
              <p className="text-[#7A766E]">
                You agree to provide accurate information and genuine photos representing yourself. Impersonation of other individuals is strictly prohibited.
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] space-y-1">
              <h4 className="font-bold text-[#111111]">3. Account Termination</h4>
              <p className="text-[#7A766E]">
                ARROW reserves the right to suspend or terminate accounts that violate community safety guidelines or abuse platform services.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
