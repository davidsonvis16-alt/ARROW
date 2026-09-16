import React, { useState } from 'react';
import { UserProfile, ReportReason } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface ReportModalProps {
  reportedUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport: (reason: ReportReason, details: string) => Promise<void>;
}

const REPORT_REASONS: Array<{ value: ReportReason; label: string; description: string }> = [
  {
    value: 'inappropriate_photos',
    label: 'Inappropriate content',
    description: 'Offensive bio, explicit photos, or unwanted sexual content',
  },
  {
    value: 'harassment',
    label: 'Harassment or bullying',
    description: 'Targeted hostility, abusive messages, or threats',
  },
  {
    value: 'underage',
    label: 'Suspected underage user',
    description: 'ARROW is strictly for adults aged 18 and over',
  },
  {
    value: 'fake_profile',
    label: 'Fake profile or impersonation',
    description: "Using someone else's photos or a deceptive identity",
  },
  {
    value: 'spam_scam',
    label: 'Scam or spam',
    description: 'Asking for money, promoting a service, or automated messaging',
  },
  {
    value: 'offline_behavior',
    label: 'Something that happened offline',
    description: 'Concerning behaviour during or after meeting in person',
  },
  {
    value: 'other',
    label: 'Other safety concern',
    description: 'Anything else that made you feel unsafe',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  reportedUser,
  isOpen,
  onClose,
  onSubmitReport,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('inappropriate_photos');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!reportedUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmitReport(selectedReason, details.trim());
      onClose();
    } catch (err) {
      console.error('Report submission failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title="Report & Protect Community"
      subtitle={`Reporting ${reportedUser.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-5 pb-3">
        {/* Notice */}
        <div className="p-3.5 bg-[var(--color-surface-subtle)] rounded-2xl border border-[var(--color-border-subtle)] flex items-start gap-2.5 text-xs text-[var(--color-ink-soft)]">
          <ShieldAlert size={16} className="text-[var(--color-arrow-orange-text)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Reports are kept strictly anonymous. Submitting this report will also automatically block {reportedUser.name} from interacting with you.
          </p>
        </div>

        {/* Reason Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[var(--color-ink)]">
            Reason for Report
          </label>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  selectedReason === r.value
                    ? 'bg-[var(--color-surface)] border-[var(--color-ink)] shadow-xs'
                    : 'bg-[var(--color-surface-subtle)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface)]'
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={r.value}
                  checked={selectedReason === r.value}
                  onChange={() => setSelectedReason(r.value)}
                  className="mt-0.5 accent-[var(--color-arrow-orange)]"
                />
                <div>
                  <p className="text-xs font-bold text-[var(--color-ink)]">{r.label}</p>
                  <p className="text-[11px] text-[var(--color-stone-dark)] leading-tight">
                    {r.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Additional Details */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--color-ink)]">
            Additional Details (Optional)
          </label>
          <textarea
            rows={3}
            maxLength={500}
            placeholder="Help our moderation team understand what happened..."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-xs text-[var(--color-ink)] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            fullWidth
            disabled={isSubmitting}
            icon={<AlertTriangle size={15} />}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report & Block'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
