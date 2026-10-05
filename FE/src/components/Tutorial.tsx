import { Check } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ComponentType, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../features/auth/useAuth';
import { getTutorialHidden, setTutorialHidden } from '../lib/tutorial';
import { DemoBeban, DemoKardio, DemoNav, DemoPilih, DemoPisah, DemoRep, DemoSimpan, DemoSync } from './TutorialDemos';

type Slide = { title: string; text: string; demo: ComponentType };

const SLIDES: Slide[] = [
  {
    title: 'Pilih latihan',
    text: 'Tap kotak latihan untuk mulai mencatat. Kotak + membuka daftar lengkap dan pencarian.',
    demo: DemoPilih,
  },
  {
    title: 'Tap +1 tiap rep',
    text: 'Setiap selesai satu repetisi, tap +1. Salah hitung? Tap −1.',
    demo: DemoRep,
  },
  {
    title: 'Atur beban',
    text: 'Tap − atau + untuk mengubah beban, tahan untuk lebih cepat. Beban set terakhir otomatis dipakai lagi.',
    demo: DemoBeban,
  },
  {
    title: 'Pisah beban (dumbbell)',
    text: 'Pakai dua dumbbell? Tap Pisah beban lalu atur beban satu tangan. Tercatat 10 + 10 kg, dan Progres menghitung totalnya 20 kg. Tap lagi untuk kembali ke satu beban.',
    demo: DemoPisah,
  },
  {
    title: 'Simpan set',
    text: 'Tap Simpan set lalu Simpan. Beban tetap sama untuk set berikutnya, tinggal hitung rep lagi.',
    demo: DemoSimpan,
  },
  {
    title: 'Latihan kardio',
    text: 'Untuk treadmill dan kardio lain, tap Mulai untuk menyalakan stopwatch. Lupa menyalakan? Koreksi dengan ±1 mnt.',
    demo: DemoKardio,
  },
  {
    title: 'Riwayat, Progres, Akun',
    text: 'Lihat catatan per tanggal di Riwayat dan perkembanganmu di Progres. Tutorial ini bisa dibuka lagi dari Akun.',
    demo: DemoNav,
  },
  {
    title: 'Tetap jalan tanpa sinyal',
    text: 'Catatan tersimpan dulu di HP, lalu tersinkron ke akunmu begitu ada internet.',
    demo: DemoSync,
  },
];

const SWIPE_PX = 48;

// Tutorial cara pakai: slide layar penuh dengan peraga animasi. Muncul otomatis di Pilih latihan
// (sampai "Jangan tampilkan lagi" dicentang) dan bisa dibuka dari Akun.
export function Tutorial({ onClose, doneLabel = 'Mulai latihan' }: { onClose: () => void; doneLabel?: string }) {
  const { user } = useAuth();
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hidden, setHidden] = useState(() => getTutorialHidden(user?.id));
  const dialogRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);

  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index]!;
  const Demo = slide.demo;

  const go = (delta: 1 | -1) => {
    const next = index + delta;
    if (next < 0 || next >= SLIDES.length) return;
    setDir(delta);
    setIndex(next);
  };

  // Halaman induk bisa render ulang (data Dexie berubah); fokus dan kunci scroll cukup dipasang sekali
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const toggleHidden = (next: boolean) => {
    setHidden(next);
    setTutorialHidden(user?.id, next);
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  return createPortal(
    <div className="tutorial" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
      <div className="tutorial__inner">
        <div className="tutorial__top">
          <span className="tutorial__count num">
            {index + 1} / {SLIDES.length}
          </span>
          {!last && (
            <button type="button" className="text-btn tutorial__skip" onClick={onClose}>
              Lewati
            </button>
          )}
        </div>

        <div
          key={index}
          className={dir === 1 ? 'tutorial__slide' : 'tutorial__slide is-back'}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
        >
          <div className="tutorial__stage">
            <Demo />
          </div>
          <h2 id={titleId} className="tutorial__title">
            {slide.title}
          </h2>
          <p className="tutorial__text">{slide.text}</p>
        </div>

        <div className="tutorial__dots" aria-hidden>
          {SLIDES.map((s, i) => (
            <span key={s.title} className={i === index ? 'tutorial__dot is-active' : 'tutorial__dot'} />
          ))}
        </div>

        <label className="tutorial__check">
          <input type="checkbox" checked={hidden} onChange={(e) => toggleHidden(e.target.checked)} />
          <span className="tutorial__box" aria-hidden>
            <Check size={16} strokeWidth={2.5} />
          </span>
          Jangan tampilkan lagi
        </label>

        <div className="tutorial__actions">
          {index > 0 && (
            <button type="button" className="btn btn--secondary" onClick={() => go(-1)}>
              Kembali
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={last ? onClose : () => go(1)}>
            {last ? doneLabel : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
