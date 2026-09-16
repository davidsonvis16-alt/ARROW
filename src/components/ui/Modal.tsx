import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: 'center' | 'bottomSheet';
  maxWidth?: 'sm' | 'md' | 'lg' | 'full';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  variant = 'center',
  maxWidth = 'md',
  showCloseButton = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-xl',
  };

  if (variant === 'bottomSheet') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200">
        <div
          className="fixed inset-0"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          className={`relative z-10 w-full ${maxWidthStyles[maxWidth]} max-h-[90vh] bg-[var(--color-offwhite)] rounded-t-[32px] border-t border-x border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250`}
        >
          {/* Drag Pill */}
          <div className="pt-3.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1.5 rounded-full bg-[var(--color-border)]" />
          </div>

          {/* Header */}
          {(title || showCloseButton) && (
            <div className="px-6 md:px-8 py-4 flex items-center justify-between border-b border-[var(--color-border)]">
              <div>
                {title && (
                  <h3 className="text-lg font-bold tracking-tight text-[var(--color-ink)]">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-[var(--color-stone-dark)] mt-0.5">{subtitle}</p>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full text-[var(--color-stone-dark)] hover:text-[var(--color-ink)] hover:bg-[var(--color-stone-light)] transition-colors cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-6 md:p-8 overflow-y-auto">{children}</div>
        </div>
      </div>
    );
  }

  // Center Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${maxWidthStyles[maxWidth]} bg-[var(--color-offwhite)] rounded-[32px] border border-[var(--color-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="px-6 md:px-8 py-5 flex items-center justify-between border-b border-[var(--color-border)]">
            <div>
              {title && (
                <h3 className="text-lg font-bold tracking-tight text-[var(--color-ink)]">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-[var(--color-stone-dark)] mt-0.5">{subtitle}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-[var(--color-stone-dark)] hover:text-[var(--color-ink)] hover:bg-[var(--color-stone-light)] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6 md:p-8 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

