import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { authService } from '../../services/authService';
import { useToast } from '../ui/Toast';
import { KeyRound, AlertTriangle } from 'lucide-react';

interface NewPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Shown when someone arrives from a password reset email.
 *
 * Supabase has already exchanged the link for a session by this point, so the
 * account is reachable until a new password is set. Closing without setting one
 * leaves it that way, which is why this asks rather than offers.
 */
export const NewPasswordModal: React.FC<NewPasswordModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Please choose a password of at least 8 characters.');
      return;
    }

    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await authService.updatePassword(password);
      showToast('Your password has been updated', 'success');
      setPassword('');
      setConfirm('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not update your password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="center" maxWidth="sm" title="Set a new password">
      <form onSubmit={submit} className="space-y-4 pb-1">
        <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-input)] bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)]">
          <KeyRound size={15} className="shrink-0 mt-0.5 text-[var(--color-forest)]" />
          <p className="text-[11px] text-[var(--color-stone-dark)] leading-relaxed">
            You followed a reset link, so you are signed in right now. Choose a new password
            to finish.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="new-password" className="text-xs font-bold text-[var(--color-ink)]">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full px-3.5 py-2.5 rounded-[var(--radius-input)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-xs text-[var(--color-ink)]"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm-password" className="text-xs font-bold text-[var(--color-ink)]">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
            className="w-full px-3.5 py-2.5 rounded-[var(--radius-input)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-xs text-[var(--color-ink)]"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-[var(--radius-input)] bg-[var(--color-danger-subtle)] text-[var(--color-danger-text)] text-xs">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button variant="primary" fullWidth type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Update password'}
        </Button>
      </form>
    </Modal>
  );
};
