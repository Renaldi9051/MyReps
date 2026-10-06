import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastInput = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

type ToastState = ToastInput & { id: number; leaving?: boolean };

const LEAVE_MS = 180; // sama dengan animasi toast-out di app.css

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

// Satu toast sekaligus; dipakai untuk "Set dihapus · Urungkan" (F5.3, 5 detik)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const show = useCallback((input: ToastInput) => {
    counter.current += 1;
    setToast({ ...input, id: counter.current });
  }, []);

  // Habis waktu: toast naik memudar dulu, lalu dilepas
  useEffect(() => {
    if (!toast) return;
    const id = toast.leaving
      ? setTimeout(() => setToast(null), LEAVE_MS)
      : setTimeout(() => setToast({ ...toast, leaving: true }), toast.durationMs ?? 5000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className={toast.leaving ? 'toast is-leaving' : 'toast'} key={toast.id}>
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (toast: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return ctx;
}
