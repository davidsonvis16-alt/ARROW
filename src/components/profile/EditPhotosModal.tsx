import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { useToast } from '../ui/Toast';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from 'lucide-react';

interface EditPhotosModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  /** Called with the final order and anything removed, after the user saves. */
  onUpdatePhotos: (keptRefs: string[], removedRefs: string[]) => Promise<void>;
}

interface PhotoItem {
  url: string;
  ref: string;
}

const MAX_PHOTOS = 6;

function itemsFrom(user: UserProfile): PhotoItem[] {
  return (user.photos || []).map((url, i) => ({ url, ref: user.photoRefs?.[i] ?? url }));
}

/**
 * Add, remove and reorder profile photos.
 *
 * Uploads are saved the moment they finish (so a slow upload is never lost to
 * a closed sheet). Removals and the new order are applied together on Save,
 * using each photo's stored reference rather than its display URL — the URL is
 * a signed link that expires, the reference is what the server knows.
 *
 * Every control is always visible: phones have no hover, so actions hidden
 * behind one are actions half your users cannot reach.
 */
export const EditPhotosModal: React.FC<EditPhotosModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onUpdatePhotos,
}) => {
  const [items, setItems] = useState<PhotoItem[]>(() => itemsFrom(currentUser));
  const [removed, setRemoved] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setItems(itemsFrom(currentUser));
      setRemoved([]);
    }
    // Reset only when the sheet opens, not on every profile refresh behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const addFiles = async (fileList: FileList | File[]) => {
    const room = MAX_PHOTOS - items.length;
    const files = Array.from(fileList).slice(0, Math.max(0, room));
    if (files.length === 0) {
      showToast(`You can have up to ${MAX_PHOTOS} photos`, 'warning');
      return;
    }

    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const uploaded = await api.uploadPhoto(file, currentUser.id);
        setItems((prev) => [...prev, uploaded]);
      } catch (err: any) {
        showToast(err.message || `Could not upload ${file.name}`, 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const handleRemove = (index: number) => {
    if (items.length <= 1) {
      showToast('Keep at least one photo so people can see you', 'warning');
      return;
    }
    setRemoved((prev) => [...prev, items[index].ref]);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const move = (index: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdatePhotos(
        items.map((i) => i.ref),
        removed
      );
      showToast('Photos saved', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Could not save your photos', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const isBusy = uploading > 0 || isSaving;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="md"
      title="Your photos"
      subtitle="Your first photo is the one people see first"
    >
      <div className="space-y-5 pb-2">
        <div className="grid grid-cols-3 gap-2.5">
          {items.map((item, idx) => (
            <div
              key={item.ref}
              className={`relative aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--color-stone-light)] border-2 ${
                idx === 0 ? 'border-[var(--color-arrow-orange)]' : 'border-transparent'
              }`}
            >
              <img
                src={item.url}
                alt={`Photo ${idx + 1}`}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />

              {idx === 0 && (
                <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--color-arrow-orange)] text-white text-[9px] font-black uppercase tracking-wider">
                  <Star size={9} fill="currentColor" />
                  Main
                </div>
              )}

              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm active:scale-95 transition-transform"
                aria-label={`Remove photo ${idx + 1}`}
              >
                <Trash2 size={14} />
              </button>

              <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => move(idx, idx - 1)}
                  disabled={idx === 0}
                  className="w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm disabled:opacity-0 active:scale-95 transition-transform"
                  aria-label={`Move photo ${idx + 1} earlier`}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, idx + 1)}
                  disabled={idx === items.length - 1}
                  className="w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm disabled:opacity-0 active:scale-95 transition-transform"
                  aria-label={`Move photo ${idx + 1} later`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}

          {Array.from({ length: Math.min(uploading, MAX_PHOTOS - items.length) }).map((_, i) => (
            <div
              key={`uploading-${i}`}
              className="aspect-[3/4] rounded-2xl bg-[var(--color-surface-subtle)] border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center gap-2"
            >
              <div className="w-5 h-5 border-2 border-[var(--color-arrow-orange)] border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-bold text-[var(--color-stone-dark)]">Uploading</span>
            </div>
          ))}

          {items.length + uploading < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              className="aspect-[3/4] rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:border-[var(--color-arrow-orange)] transition-colors flex flex-col items-center justify-center gap-1.5 text-[var(--color-ink)]"
            >
              <ImagePlus size={20} className="text-[var(--color-arrow-orange-text)]" />
              <span className="text-[11px] font-bold">Add photo</span>
              <span className="text-[10px] text-[var(--color-stone-dark)]">
                {MAX_PHOTOS - items.length - uploading} left
              </span>
            </button>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
        />
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileChange}
          accept="image/*"
          capture="user"
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            size="sm"
            icon={<ImagePlus size={14} />}
            onClick={() => fileInputRef.current?.click()}
            disabled={items.length + uploading >= MAX_PHOTOS}
          >
            From gallery
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Camera size={14} />}
            onClick={() => cameraInputRef.current?.click()}
            disabled={items.length + uploading >= MAX_PHOTOS}
          >
            Take a selfie
          </Button>
        </div>

        <p className="text-[11px] text-[var(--color-stone-dark)] leading-relaxed">
          Use clear, recent photos of you alone in your main photo. Photos are resized and
          stripped of location data on your device before they upload. Photos of other people
          without their consent, of minors, or that are sexual or violent break our Terms and
          will be removed.
        </p>

        <div className="flex items-center gap-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={handleSave} disabled={isBusy}>
            {isSaving ? 'Saving…' : uploading > 0 ? 'Uploading…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
