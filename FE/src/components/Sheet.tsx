import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
};

const CLOSE_MS = 180; // sama dengan animasi sheet-out di app.css

// Panel dari bawah untuk menu, edit set, pilih latihan, dan ringkasan
export function Sheet({ title, onClose, children, tall }: Props) {
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const requestClose = () => setClosing(true);

  // Tutup lewat X, latar, atau Escape: sheet turun dulu, baru dilepas dari layar
  useEffect(() => {
    if (!closing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      closeRef.current();
      return;
    }
    const id = window.setTimeout(() => closeRef.current(), CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [closing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClosing(true);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  return createPortal(
    <div className={closing ? 'sheet-backdrop is-closing' : 'sheet-backdrop'} onClick={requestClose}>
      <div
        className={tall ? 'sheet sheet--tall' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__header">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <button type="button" className="icon-circle" aria-label="Tutup" onClick={requestClose}>
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
