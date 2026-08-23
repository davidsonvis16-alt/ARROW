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
    value: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Offensive bio, inappropriate photos, or unwanted behavior',
  },
  {
    value: 'harassment',
    label: 'Harassment & Bullying',
    description: 'Targeted hostility, abusive messages, or threats',
  },
  {
    value: 'underage',
    label: 'Suspected Underage User',
    description: 'Arrow is strictly for adults aged 18 and older',
  },
  {
    value: 'impersonation',
    label: 'Impersonation or Fake Profile',
    description: 'Using someone else\'s photos or deceptive identity',
  },
  {
    value: 'scam',
    label: 'Scam or Commercial Solicitation',
    description: 'Asking for money, cryptocurrency, or promoting services',
  },
  {
    value: 'spam',
    label: 'Spam or Bot',
    description: 'Repetitive or automated non-human interactions',
  },
  {
    value: 'other',
    label: 'Other Safety Concern',
    description: 'Any other safety or security violation',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  reportedUser,
  isOpen,
  onClose,
  onSubmitReport,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('inappropriate');
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
        <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E2DDD5] flex items-start gap-2.5 text-xs text-[#333333]">
          <ShieldAlert size={16} className="text-[#E85D2A] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Reports are kept strictly anonymous. Submitting this report will also automatically block {reportedUser.name} from interacting with you.
          </p>
        </div>

        {/* Reason Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#111111]">
            Reason for Report
          </label>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  selectedReason === r.value
                    ? 'bg-white border-[#111111] shadow-xs'
                    : 'bg-[#FAF8F4] border-[#E2DDD5] hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={r.value}
                  checked={selectedReason === r.value}
                  onChange={() => setSelectedReason(r.value)}
                  className="mt-0.5 accent-[#E85D2A]"
                />
                <div>
                  <p className="text-xs font-bold text-[#111111]">{r.label}</p>
                  <p className="text-[11px] text-[#7A766E] leading-tight">
                    {r.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Additional Details */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#111111]">
            Additional Details (Optional)
          </label>
          <textarea
            rows={3}
            maxLength={500}
            placeholder="Help our moderation team understand what happened..."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DDD5] bg-white text-xs text-[#111111] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-[#E2DDD5]">
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
