import { useEffect } from 'react';
import { applyTheme } from './theme';

// Layar pembuka #boot (index.html) menutupi app saat dibuka dari ikon: menyambung splash bawaan HP,
// menahan logo minimal MIN_SHOW_MS sambil halaman pertama disiapkan di baliknya (status login, data
// Dexie, font), lalu logo memudar membesar disusul latar yang memudar. Animasi memakai Web Animations
// (opacity/transform, jalan di compositor) dan baru dimulai saat main thread senggang, jadi tidak
// tersendat oleh kerja awal app.
const MIN_SHOW_MS = 1200; // dihitung dari app mulai dibuka (performance.now), bukan dari hideBoot
const FONT_WAIT_MS = 1200;
const IDLE_WAIT_MS = 300;
const LOGO_OUT_MS = 320;
const BG_DELAY_MS = 140;
const BG_OUT_MS = 420;
const SAFETY_MS = 3000; // jaring pengaman kalau tidak ada halaman yang memberi sinyal siap

let requested = false;
let resolveHidden: () => void = () => {};
const hidden = new Promise<void>((resolve) => {
  resolveHidden = resolve;
});

// Untuk tampilan yang baru boleh muncul setelah layar pembuka hilang (mis. tutorial)
export function whenBootHidden(): Promise<void> {
  return document.getElementById('boot') ? hidden : Promise.resolve();
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

// Tunggu main thread lega (kerja awal seperti render dan sinkron selesai) supaya pudarnya tidak tersendat
const idle = () =>
  new Promise<void>((resolve) => {
    // Safari iOS belum punya requestIdleCallback
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: IDLE_WAIT_MS });
    } else {
      setTimeout(resolve, 50);
    }
  });

const nextFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export function hideBoot() {
  if (requested) return;
  requested = true;
  const el = document.getElementById('boot');
  if (!el) return;

  const fonts = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  const hold = wait(Math.max(0, MIN_SHOW_MS - performance.now()));
  void Promise.all([Promise.race([fonts, wait(FONT_WAIT_MS)]), hold])
    .then(idle)
    // Dua frame: pastikan halaman sudah tergambar di balik layar pembuka
    .then(nextFrames)
    .then(() => fadeOut(el));
}

function fadeOut(el: HTMLElement) {
  el.style.pointerEvents = 'none';
  const done = () => {
    el.remove();
    applyTheme(); // pastikan warna status bar mengikuti tema
    resolveHidden();
  };
  if (typeof el.animate !== 'function') {
    done();
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const logo = el.firstElementChild;
  if (logo && !reduced) {
    logo.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(1.12)' },
      ],
      { duration: LOGO_OUT_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
    );
  }
  const delay = reduced ? 0 : BG_DELAY_MS;
  const duration = reduced ? 160 : BG_OUT_MS;
  const bg = el.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration,
    delay,
    easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
    fill: 'forwards',
  });
  // Status bar tidak bisa dianimasikan: ganti warnanya saat latar setengah pudar supaya tersamar
  window.setTimeout(applyTheme, delay + duration / 2);
  bg.finished.then(done, done);
}

export function scheduleBootSafety() {
  window.setTimeout(hideBoot, SAFETY_MS);
}

// Dipanggil halaman pertama: layar pembuka baru memudar setelah isinya siap
export function useBootReady(ready: boolean) {
  useEffect(() => {
    if (ready) hideBoot();
  }, [ready]);
}
