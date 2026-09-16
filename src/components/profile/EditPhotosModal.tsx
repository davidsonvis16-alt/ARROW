import React, { useState, useRef } from 'react';
import { UserProfile } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { useToast } from '../ui/Toast';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';

interface EditPhotosModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePhotos: (photos: string[]) => Promise<void>;
}

export const EditPhotosModal: React.FC<EditPhotosModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onUpdatePhotos,
}) => {
  const [photos, setPhotos] = useState<string[]>(currentUser.photos || []);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (photos.length >= 6) {
      showToast('Maximum 6 photos allowed', 'warning');
      return;
    }

    const file = files[0];
    setIsUploading(true);
    try {
      const photoUrl = await api.uploadPhoto(file, currentUser.id);
      setPhotos([...photos, photoUrl]);
      showToast('Photo uploaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (photos.length >= 6) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const photoUrl = await api.uploadPhoto(file, currentUser.id);
      setPhotos([...photos, photoUrl]);
      showToast('Photo uploaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    if (photos.length <= 1) {
      showToast('You must have at least one profile photo', 'warning');
      return;
    }
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleMakeMain = (index: number) => {
    if (index === 0) return;
    const item = photos[index];
    const rest = photos.filter((_, i) => i !== index);
    setPhotos([item, ...rest]);
    showToast('Primary profile photo updated', 'info');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdatePhotos(photos);
      showToast('Photos saved', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to save photos', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title="Manage Photos"
      subtitle="The first photo will be your primary discovery card"
    >
      <div className="space-y-6 pb-4">
        {/* Photo Grid */}
        <div className="grid grid-cols-3 gap-3">
          {photos.map((url, idx) => (
            <div
              key={idx}
              className={`relative aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--color-stone-light)] border-2 group ${
                idx === 0 ? 'border-[var(--color-arrow-orange)]' : 'border-[var(--color-border-subtle)]'
              }`}
            >
              <img
                src={url}
                alt={`Photo ${idx + 1}`}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />

              {/* Main Badge */}
              {idx === 0 && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[var(--color-arrow-orange)] text-white text-[9px] font-black uppercase tracking-wider">
                  Main
                </div>
              )}

              {/* Photo Actions Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-1 rounded-lg bg-black/60 text-white hover:bg-[var(--color-danger)] transition-colors"
                    title="Delete photo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={() => handleMakeMain(idx)}
                    className="py-1 px-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-ink)] text-[10px] font-bold flex items-center justify-center hover:bg-[var(--color-stone-light)] transition-colors"
                  >
                    <span>Set Main</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Upload Placeholder Slot if < 6 */}
          {photos.length < 6 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="aspect-[3/4] rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface-subtle)]/80 hover:border-[var(--color-ink)] transition-colors flex flex-col items-center justify-center p-3 text-center cursor-pointer"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
              <div className="p-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-[var(--color-ink)] mb-1.5 shadow-xs">
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-[var(--color-arrow-orange)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
              </div>
              <span className="text-[11px] font-bold text-[var(--color-ink)]">
                {isUploading ? 'Uploading...' : 'Add Photo'}
              </span>
              <span className="text-[9px] text-[var(--color-stone-dark)] mt-0.5">
                Drop or click
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border-subtle)] flex items-start gap-2.5 text-xs text-[var(--color-stone-dark)]">
          <ImageIcon size={16} className="text-[var(--color-forest)] shrink-0 mt-0.5" />
          <p className="leading-tight">
            High quality portraits with natural lighting make the strongest impression. You can upload up to 6 photos.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <Button
            variant="ghost"
            fullWidth
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={handleSave}
            disabled={isSaving || isUploading}
            arrow="right"
          >
            {isSaving ? 'Saving...' : 'Save Photos'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
