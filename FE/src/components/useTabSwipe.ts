import { useEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { TAB_PATHS } from '../lib/nav';

const SLOP = 10; // px sebelum gerakan dianggap geser, bukan tap
const DISTANCE = 0.25; // bagian lebar layar yang harus digeser untuk pindah tab
const FLICK = 0.35; // px/ms: kibasan cepat tetap pindah walau jaraknya pendek
const BACK_MS = 220;
const BACK_EASE = 'cubic-bezier(0.2, 0.8, 0.3, 1)';

type Drag = {
  id: number;
  x: number;
  y: number;
  w: number;
  body: HTMLElement;
  locked: boolean;
  samples: { t: number; x: number }[];
};

export type SwipeNavState = { swipe: true };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Area yang punya geser horizontal sendiri (kotak tanggal, heatmap setahun) atau isian.
// Catatan: wadah overflow-x: auto memutus touch-action pan-y dari .screen__body, jadi browser
// tetap mengambil geser horizontal di dalamnya walau isinya muat. Wadah seperti itu yang tidak
// melebar perlu touch-action: pan-y sendiri (lihat ActivityHeatmap).
function ownsGesture(target: Element, body: HTMLElement): boolean {
  for (let el: Element | null = target; el && el !== body; el = el.parentElement) {
    if (el.matches('input, textarea, select, [data-no-tab-swipe]')) return true;
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true;
  }
  return false;
}

// Kartu: isi bergeser ikut jari, sedikit mengecil dan memudar makin jauh digeser
function paint(body: HTMLElement, progress: number) {
  const a = Math.abs(progress);
  body.style.transform = `translate3d(${progress * 100}%, 0, 0) scale(${1 - 0.05 * a})`;
  body.style.opacity = String(1 - 0.4 * a);
}

function clear(body: HTMLElement) {
  body.style.transform = '';
  body.style.opacity = '';
  body.style.transformOrigin = '';
  body.style.willChange = '';
}

// Geser kiri/kanan di isi halaman tab (Latihan, Riwayat, Progres, Akun) untuk pindah ke tab sebelahnya.
// Listener native di .screen: sheet dan tutorial dipasang lewat portal di luar .screen, jadi tidak ikut.
// Posisi diubah langsung lewat style (bukan state React) supaya tiap frame ringan di HP.
// Mengembalikan true kalau halaman sekarang adalah halaman tab (bisa digeser).
export function useTabSwipe(screenRef: RefObject<HTMLElement | null>): boolean {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const index = (TAB_PATHS as readonly string[]).indexOf(pathname);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen || index < 0) return;
    let drag: Drag | null = null;
    let swiped = false;
    let busy = false;
    let disposed = false;
    let frame = 0;

    const targetOf = (dx: number) => TAB_PATHS[index + (dx < 0 ? 1 : -1)];

    const restore = (body: HTMLElement) => {
      const from = { transform: body.style.transform, opacity: body.style.opacity };
      body.style.transform = '';
      body.style.opacity = '';
      // Titik tumpu skala tetap selama kembali; jangan diganggu kalau jari sudah menggeser lagi
      const done = () => {
        if (!drag) clear(body);
      };
      if (reducedMotion()) done();
      else body.animate([from, { transform: 'none', opacity: 1 }], { duration: BACK_MS, easing: BACK_EASE }).finished.then(done, done);
    };

    const commit = (body: HTMLElement, dx: number, to: string) => {
      busy = true;
      const go = () => {
        if (!disposed) navigateRef.current(to, { state: { swipe: true } satisfies SwipeNavState });
      };
      if (reducedMotion()) {
        go();
        return;
      }
      // Kartu meluncur keluar sisa jaraknya, lalu tab tujuan masuk dari sisi seberang (CSS data-swipe)
      const a = Math.abs(dx) / body.clientWidth;
      const dir = dx < 0 ? -1 : 1;
      body.animate(
        [
          { transform: body.style.transform, opacity: body.style.opacity },
          { transform: `translate3d(${dir * 100}%, 0, 0) scale(0.95)`, opacity: 0 },
        ],
        { duration: Math.round(90 + 130 * (1 - a)), easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
      ).finished.then(go, go);
    };

    const onDown = (e: PointerEvent) => {
      swiped = false;
      if (busy || drag || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const target = e.target as Element;
      const body = target.closest<HTMLElement>('.screen__body');
      if (!body || !screen.contains(body) || ownsGesture(target, body)) return;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        w: body.clientWidth,
        body,
        locked: false,
        samples: [{ t: performance.now(), x: e.clientX }],
      };
    };

    const onMove = (e: PointerEvent) => {
      const d = drag;
      if (!d || d.id !== e.pointerId) return;
      let dx = e.clientX - d.x;
      if (!d.locked) {
        const dy = e.clientY - d.y;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          drag = null; // geser vertikal: biarkan browser scroll
          return;
        }
        d.locked = true;
        swiped = true;
        screen.setPointerCapture(e.pointerId);
        window.getSelection()?.removeAllRanges();
        // Mengecil dari tengah layar yang terlihat, bukan tengah halaman yang mungkin panjang
        d.body.style.transformOrigin = `50% ${window.innerHeight / 2 - d.body.getBoundingClientRect().top}px`;
        d.body.style.willChange = 'transform, opacity';
      }
      d.samples.push({ t: performance.now(), x: e.clientX });
      if (d.samples.length > 6) d.samples.shift();
      // Tab paling kiri/kanan: isi hanya bergeser sedikit sebagai tanda
      if (!targetOf(dx)) dx /= 3;
      dx = Math.max(-d.w, Math.min(d.w, dx));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => paint(d.body, dx / d.w));
    };

    const onUp = (e: PointerEvent) => {
      const d = drag;
      if (!d || d.id !== e.pointerId) return;
      drag = null;
      if (!d.locked) return;
      cancelAnimationFrame(frame);
      const dx = e.clientX - d.x;
      const now = performance.now();
      const from = d.samples.find((s) => now - s.t < 100) ?? d.samples[0];
      const v = from && now > from.t ? (e.clientX - from.x) / (now - from.t) : 0;
      const to = targetOf(dx);
      const far = Math.abs(dx) > d.w * DISTANCE;
      const flick = Math.abs(v) > FLICK && Math.sign(v) === Math.sign(dx);
      if (to && (far || flick)) commit(d.body, Math.max(-d.w, Math.min(d.w, dx)), to);
      else restore(d.body);
    };

    const onCancel = (e: PointerEvent) => {
      const d = drag;
      if (!d || d.id !== e.pointerId) return;
      drag = null;
      cancelAnimationFrame(frame);
      if (d.locked) restore(d.body);
    };

    // Jari yang berakhir sebagai geser tidak boleh ikut menekan tombol di bawahnya
    const onClick = (e: MouseEvent) => {
      if (!swiped) return;
      swiped = false;
      e.preventDefault();
      e.stopPropagation();
    };

    screen.addEventListener('pointerdown', onDown);
    screen.addEventListener('pointermove', onMove);
    screen.addEventListener('pointerup', onUp);
    screen.addEventListener('pointercancel', onCancel);
    screen.addEventListener('click', onClick, true);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (drag?.locked) clear(drag.body);
      screen.removeEventListener('pointerdown', onDown);
      screen.removeEventListener('pointermove', onMove);
      screen.removeEventListener('pointerup', onUp);
      screen.removeEventListener('pointercancel', onCancel);
      screen.removeEventListener('click', onClick, true);
    };
  }, [index, screenRef]);

  return index >= 0;
}
