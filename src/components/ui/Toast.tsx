import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastMessage } from '../../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastContextType {
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      const id = `toast_${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type, duration: 3500 }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map((t) => {
          let icon = <Info size={16} className="text-[var(--color-ink)] shrink-0" />;
          let borderStyle = 'border-[var(--color-border-subtle)] bg-[var(--color-surface)]';

          if (t.type === 'success') {
            icon = <CheckCircle2 size={16} className="text-[var(--color-forest)] shrink-0" />;
            borderStyle = 'border-[var(--color-border-subtle)] bg-[var(--color-forest-subtle)]';
          } else if (t.type === 'error' || t.type === 'warning') {
            icon = <AlertCircle size={16} className="text-[var(--color-arrow-orange)] shrink-0" />;
            borderStyle = 'border-[var(--color-danger)] bg-[var(--color-arrow-orange-subtle)]';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl border ${borderStyle} shadow-lg text-xs font-medium text-[var(--color-ink)] animate-in fade-in slide-in-from-top-2 duration-200`}
            >
              <div className="flex items-center gap-2.5">
                {icon}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 hover:bg-black/5 rounded-full ml-2"
                aria-label="Dismiss message"
              >
                <X size={14} className="text-[var(--color-stone-dark)]" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
