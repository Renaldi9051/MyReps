import {
  BarChart3,
  Calendar,
  Check,
  Cloud,
  CloudCheck,
  CloudOff,
  Dumbbell,
  Plus,
  Minus,
  Pointer,
  RefreshCw,
  Search,
  Smartphone,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { formatDuration, formatWeight } from '../lib/format';

// Peraga animasi untuk tiap slide tutorial: tiruan kecil layar MyReps (272 × 196) dan jari yang
// mengetuk tombol lalu memperlihatkan hasilnya. Tiap peraga berupa daftar langkah yang berulang;
// posisi tombol dan sasaran jari diambil dari Rect yang sama supaya selalu pas.

type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

const W = 272;
const H = 196;
const REST: Point = { x: W - 34, y: H - 22 };

const box = (r: Rect): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h });
const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

type Frame<T extends string> = { ms: number; on?: T; tap?: boolean };

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

// Jalankan langkah berulang. Dengan "kurangi gerakan" peraga diam di satu langkah yang paling menjelaskan.
function useFrames<F extends Frame<string>>(frames: readonly F[], still: number) {
  type Target = NonNullable<F['on']>;
  const [reduced] = useState(() => reducedQuery.matches);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % frames.length), frames[index]!.ms);
    return () => window.clearTimeout(t);
  }, [frames, index, reduced]);

  const i = reduced ? still : index;
  const frame = frames[i]!;
  // Tombol yang sedang diketuk dipasang ulang (key) supaya animasi tekannya terulang tiap ketukan
  const tapped = (target: Target) => frame.tap === true && frame.on === target;
  const pressKey = (target: Target) => (tapped(target) ? `${target}-${i}` : target);
  return { frame, index: i, tapped, pressKey };
}

function Mock({ children }: { children: ReactNode }) {
  return (
    <div className="tut-mock" aria-hidden>
      {children}
    </div>
  );
}

type FingerProps = { at: Point | undefined; tap: boolean | undefined; index: number; rest?: Point };

function Finger({ at, tap, index, rest = REST }: FingerProps) {
  const p = at ?? rest;
  return (
    <span className="tut-finger" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
      {tap && <span key={`ripple-${index}`} className="tut-finger__ripple" />}
      <span key={tap ? `hand-${index}` : 'hand'} className={tap ? 'tut-finger__hand is-tap' : 'tut-finger__hand'}>
        <Pointer className="tut-finger__halo" size={34} strokeWidth={5} />
        <Pointer size={34} strokeWidth={1.75} />
      </span>
    </span>
  );
}

/* ---------- 1. Pilih latihan ---------- */

const TILE_NAMES = ['Bench Press', 'Squat', 'Lat Pulldown', 'Chest Press', 'Treadmill'];
const tileRect = (i: number): Rect => ({ x: 14 + (i % 3) * 84, y: 42 + Math.floor(i / 3) * 58, w: 76, h: 50 });
const PILIH_POS = { bench: center(tileRect(0)), plus: center(tileRect(5)) };
type PilihFrame = Frame<keyof typeof PILIH_POS> & { active?: boolean; sheet?: boolean };
const PILIH: PilihFrame[] = [
  { ms: 700 },
  { ms: 550, on: 'bench' },
  { ms: 1100, on: 'bench', tap: true, active: true },
  { ms: 550, on: 'plus' },
  { ms: 350, on: 'plus', tap: true },
  { ms: 1800, sheet: true },
];

export function DemoPilih() {
  const { frame, index, tapped, pressKey } = useFrames(PILIH, 2);
  return (
    <Mock>
      <span className="tut-abs tut-pill" style={box({ x: 101, y: 12, w: 70, h: 18 })}>
        Latihan
      </span>
      {TILE_NAMES.map((name, i) => (
        <span
          key={i === 0 ? pressKey('bench') : name}
          className={cx('tut-abs tut-tile', i === 0 && frame.active && 'is-active', i === 0 && tapped('bench') && 'is-pressed')}
          style={box(tileRect(i))}
        >
          {name}
        </span>
      ))}
      <span
        key={pressKey('plus')}
        className={cx('tut-abs tut-tile is-active', tapped('plus') && 'is-pressed')}
        style={box(tileRect(5))}
      >
        <Plus size={20} strokeWidth={1.75} />
      </span>
      <span className={cx('tut-abs tut-dim', frame.sheet && 'is-open')} />
      <span className={cx('tut-abs tut-sheet', frame.sheet && 'is-open')} style={{ height: 112 }}>
        <span className="tut-sheet__title">Pilih latihan</span>
        <span className="tut-search">
          <Search size={13} strokeWidth={1.75} />
          Cari latihan
        </span>
        <span className="tut-row">Deadlift</span>
        <span className="tut-row">Leg Press</span>
      </span>
      <Finger at={frame.on && PILIH_POS[frame.on]} tap={frame.tap} index={index} />
    </Mock>
  );
}

/* ---------- 2. Hitung rep ---------- */

const RING: Rect = { x: 88, y: 26, w: 96, h: 96 };
const LEFT: Rect = { x: 50, y: 140, w: 44, h: 44 };
const MID: Rect = { x: 106, y: 132, w: 60, h: 60 };
const RIGHT: Rect = { x: 178, y: 140, w: 44, h: 44 };

const REP_POS = { minus: center(LEFT), plus: center(MID) };
type RepFrame = Frame<keyof typeof REP_POS> & { reps: number };
const REP: RepFrame[] = [
  { ms: 700, reps: 0 },
  { ms: 500, on: 'plus', reps: 0 },
  { ms: 420, on: 'plus', tap: true, reps: 1 },
  { ms: 420, on: 'plus', tap: true, reps: 2 },
  { ms: 420, on: 'plus', tap: true, reps: 3 },
  { ms: 420, on: 'plus', tap: true, reps: 4 },
  { ms: 600, on: 'minus', reps: 4 },
  { ms: 800, on: 'minus', tap: true, reps: 3 },
  { ms: 1200, reps: 3 },
];

export function DemoRep() {
  const { frame, index, tapped, pressKey } = useFrames(REP, 5);
  return (
    <Mock>
      <span className="tut-abs tut-info" style={box({ x: 0, y: 6, w: W, h: 16 })}>
        Set 1 · set pertama
      </span>
      <span className="tut-abs tut-ring" style={box(RING)}>
        <span key={frame.reps} className="tut-ring__value">
          {frame.reps}
        </span>
        <span className="tut-ring__label">rep</span>
      </span>
      <span key={pressKey('minus')} className={cx('tut-abs tut-round', tapped('minus') && 'is-pressed')} style={box(LEFT)}>
        −1
      </span>
      <span
        key={pressKey('plus')}
        className={cx('tut-abs tut-round tut-round--plus', tapped('plus') && 'is-pressed')}
        style={box(MID)}
      >
        +1
      </span>
      <span className="tut-abs tut-round" style={box(RIGHT)}>
        Pisah
        <small>beban</small>
      </span>
      <Finger at={frame.on && REP_POS[frame.on]} tap={frame.tap} index={index} />
    </Mock>
  );
}

/* ---------- 3. Atur beban ---------- */

const STEPPER: Rect = { x: 16, y: 50, w: 240, h: 46 };
const STEP_DEC: Rect = { x: 21, y: 55, w: 36, h: 36 };
const STEP_INC: Rect = { x: 215, y: 55, w: 36, h: 36 };

const BEBAN_POS = { dec: center(STEP_DEC), inc: center(STEP_INC) };
type BebanFrame = Frame<keyof typeof BEBAN_POS> & { kg: number };
const BEBAN: BebanFrame[] = [
  { ms: 700, kg: 20 },
  { ms: 500, on: 'inc', kg: 20 },
  { ms: 550, on: 'inc', tap: true, kg: 22.5 },
  { ms: 650, on: 'inc', tap: true, kg: 25 },
  { ms: 650, on: 'dec', kg: 25 },
  { ms: 900, on: 'dec', tap: true, kg: 22.5 },
  { ms: 1200, kg: 22.5 },
];

function WeightStepper({ kg, perHand, pressKey, tapped }: {
  kg: number;
  perHand: boolean;
  pressKey: (t: 'dec' | 'inc') => string;
  tapped: (t: 'dec' | 'inc') => boolean;
}) {
  return (
    <>
      <span className="tut-abs tut-stepper" style={box(STEPPER)}>
        <span className="muted">Beban </span>
        <b key={`${kg}-${perHand}`} className="tut-stepper__value">
          {formatWeight(kg, perHand)}
        </b>
      </span>
      <span key={pressKey('dec')} className={cx('tut-abs tut-icon-btn', tapped('dec') && 'is-pressed')} style={box(STEP_DEC)}>
        <Minus size={16} strokeWidth={1.75} />
      </span>
      <span key={pressKey('inc')} className={cx('tut-abs tut-icon-btn', tapped('inc') && 'is-pressed')} style={box(STEP_INC)}>
        <Plus size={16} strokeWidth={1.75} />
      </span>
    </>
  );
}

export function DemoBeban() {
  const { frame, index, tapped, pressKey } = useFrames(BEBAN, 3);
  return (
    <Mock>
      <span className="tut-abs tut-pill" style={box({ x: 86, y: 12, w: 100, h: 18 })}>
        Bench Press
      </span>
      <WeightStepper kg={frame.kg} perHand={false} pressKey={pressKey} tapped={tapped} />
      <span className="tut-abs tut-row tut-row--running" style={box({ x: 16, y: 116, w: 240, h: 30 })}>
        <span>
          <b>Set 1</b> · 0 × {formatWeight(frame.kg, false)}
        </span>
      </span>
      <span className="tut-abs tut-info" style={box({ x: 0, y: 166, w: W, h: 16 })}>
        Tahan + atau − untuk mengubah cepat
      </span>
      <Finger at={frame.on && BEBAN_POS[frame.on]} tap={frame.tap} index={index} />
    </Mock>
  );
}

/* ---------- 4. Pisah beban (dumbbell) ---------- */

const PISAH_BTN: Rect = { x: 200, y: 107, w: 48, h: 48 };
const PISAH_POS = { pisah: center(PISAH_BTN) };
type PisahFrame = Frame<keyof typeof PISAH_POS> & { perHand: boolean };
const PISAH: PisahFrame[] = [
  { ms: 900, perHand: false },
  { ms: 550, on: 'pisah', perHand: false },
  { ms: 1900, on: 'pisah', tap: true, perHand: true },
  { ms: 600, on: 'pisah', perHand: true },
  { ms: 1300, on: 'pisah', tap: true, perHand: false },
];

export function DemoPisah() {
  const { frame, index, tapped, pressKey } = useFrames(PISAH, 2);
  const { perHand } = frame;
  const never = () => false;
  return (
    <Mock>
      <span className="tut-abs tut-pill" style={box({ x: 81, y: 12, w: 110, h: 18 })}>
        Dumbbell Curl
      </span>
      <WeightStepper kg={10} perHand={perHand} pressKey={(t) => t} tapped={never} />
      <span className="tut-abs tut-row tut-row--running" style={box({ x: 16, y: 116, w: 174, h: 30 })}>
        <span key={String(perHand)} className="tut-row__fade">
          <b>Set 1</b> · 8 × {formatWeight(10, perHand)}
        </span>
      </span>
      <span
        key={pressKey('pisah')}
        className={cx('tut-abs tut-round', perHand && 'is-active', tapped('pisah') && 'is-pressed')}
        style={box(PISAH_BTN)}
      >
        Pisah
        <small>beban</small>
      </span>
      <span key={`info-${perHand}`} className="tut-abs tut-info tut-row__fade" style={box({ x: 0, y: 172, w: W, h: 16 })}>
        {perHand ? 'Kiri 10 + kanan 10 = total 20 kg' : 'Satu beban: 10 kg'}
      </span>
      <Finger at={frame.on && PISAH_POS[frame.on]} tap={frame.tap} index={index} />
    </Mock>
  );
}

/* ---------- 4. Simpan set ---------- */

const SAVE: Rect = { x: 16, y: 142, w: 240, h: 40 };
const SHEET_TOP = 78;
const SHEET_SAVE: Rect = { x: 16, y: 68, w: 240, h: 38 }; // relatif terhadap sheet

const SIMPAN_POS = {
  save: center(SAVE),
  confirm: center({ ...SHEET_SAVE, y: SHEET_TOP + SHEET_SAVE.y }),
};
type SimpanFrame = Frame<keyof typeof SIMPAN_POS> & { sheet?: boolean; saved?: boolean };
const SIMPAN: SimpanFrame[] = [
  { ms: 700 },
  { ms: 550, on: 'save' },
  { ms: 450, on: 'save', tap: true, sheet: true },
  { ms: 600, on: 'confirm', sheet: true },
  { ms: 380, on: 'confirm', tap: true, sheet: true },
  { ms: 2000, saved: true },
];

export function DemoSimpan() {
  const { frame, index, tapped, pressKey } = useFrames(SIMPAN, 5);
  return (
    <Mock>
      {frame.saved && (
        <span className="tut-abs tut-toast" style={box({ x: 16, y: 8, w: 240, h: 28 })}>
          Set 1 tersimpan · 10 × 20 kg
        </span>
      )}
      <span className="tut-abs tut-rows" style={{ left: 16, width: 240, bottom: 64 }}>
        {frame.saved && (
          <span className="tut-row tut-row--new">
            <span>
              <b>Set 1</b> · 10 × 20 kg
            </span>
            <Check size={14} strokeWidth={1.75} />
          </span>
        )}
        <span className="tut-row tut-row--running">
          <span>
            <b>Set {frame.saved ? 2 : 1}</b> · {frame.saved ? 0 : 10} × 20 kg
          </span>
        </span>
      </span>
      <span key={pressKey('save')} className={cx('tut-abs tut-btn', tapped('save') && 'is-pressed')} style={box(SAVE)}>
        Simpan set
      </span>
      <span className={cx('tut-abs tut-dim', frame.sheet && 'is-open')} />
      <span className={cx('tut-abs tut-sheet', frame.sheet && 'is-open')} style={{ height: H - SHEET_TOP }}>
        <span className="tut-sheet__title">Simpan set 1?</span>
        <span className="tut-sheet__value">10 × 20 kg</span>
        <span
          key={pressKey('confirm')}
          className={cx('tut-abs tut-btn', tapped('confirm') && 'is-pressed')}
          style={box(SHEET_SAVE)}
        >
          Simpan
        </span>
      </span>
      <Finger at={frame.on && SIMPAN_POS[frame.on]} tap={frame.tap} index={index} />
    </Mock>
  );
}

/* ---------- 5. Kardio ---------- */

const KARDIO_POS = { start: center(MID), addMin: center(RIGHT) };
type KardioFrame = Frame<keyof typeof KARDIO_POS> & { sec: number; running?: boolean };
const KARDIO: KardioFrame[] = [
  { ms: 700, sec: 0 },
  { ms: 500, on: 'start', sec: 0 },
  { ms: 500, on: 'start', tap: true, sec: 0, running: true },
  { ms: 500, sec: 1, running: true },
  { ms: 500, sec: 2, running: true },
  { ms: 500, on: 'addMin', sec: 3, running: true },
  { ms: 700, on: 'addMin', tap: true, sec: 63, running: true },
  { ms: 500, on: 'start', sec: 64, running: true },
  { ms: 1500, on: 'start', tap: true, sec: 64 },
];

export function DemoKardio() {
  const { frame, index, tapped, pressKey } = useFrames(KARDIO, 6);
  return (
    <Mock>
      <span className="tut-abs tut-info" style={box({ x: 0, y: 6, w: W, h: 16 })}>
        Treadmill
      </span>
      <span className="tut-abs tut-ring" style={box(RING)}>
        <span className="tut-ring__value tut-ring__value--time">{formatDuration(frame.sec)}</span>
        <span className="tut-ring__label">waktu</span>
      </span>
      <span className="tut-abs tut-round" style={box(LEFT)}>
        −1
        <small>mnt</small>
      </span>
      <span
        key={pressKey('start')}
        className={cx('tut-abs tut-round tut-round--plus tut-round--start', tapped('start') && 'is-pressed')}
        style={box(MID)}
      >
        {frame.running ? 'Stop' : 'Mulai'}
      </span>
      <span key={pressKey('addMin')} className={cx('tut-abs tut-round', tapped('addMin') && 'is-pressed')} style={box(RIGHT)}>
        +1
        <small>mnt</small>
      </span>
      <Finger at={frame.on && KARDIO_POS[frame.on]} tap={frame.tap} index={index} />
    </Mock>
  );
}

/* ---------- 6. Menu bawah ---------- */

const NAV_TOP = 146;
const TABS: { label: string; icon: LucideIcon }[] = [
  { label: 'Latihan', icon: Dumbbell },
  { label: 'Riwayat', icon: Calendar },
  { label: 'Progres', icon: BarChart3 },
  { label: 'Akun', icon: User },
];
const tabRect = (i: number): Rect => ({ x: 12 + i * 64, y: NAV_TOP + 6, w: 56, h: 38 });
const NAV_POS = { riwayat: center(tabRect(1)), progres: center(tabRect(2)), akun: center(tabRect(3)) };
type NavFrame = Frame<keyof typeof NAV_POS> & { tab: number };
const NAV: NavFrame[] = [
  { ms: 800, tab: 0 },
  { ms: 500, on: 'riwayat', tab: 0 },
  { ms: 1300, on: 'riwayat', tap: true, tab: 1 },
  { ms: 500, on: 'progres', tab: 1 },
  { ms: 1300, on: 'progres', tap: true, tab: 2 },
  { ms: 500, on: 'akun', tab: 2 },
  { ms: 1500, on: 'akun', tap: true, tab: 3 },
];
const NAV_KEYS = [null, 'riwayat', 'progres', 'akun'] as const;

// Pola heatmap contoh (level 0–4), 7 kolom × 4 baris
const HEAT = [0, 2, 0, 1, 3, 0, 0, 1, 0, 2, 0, 4, 1, 0, 0, 3, 1, 0, 2, 0, 1, 2, 0, 1, 4, 0, 3, 0];

export function DemoNav() {
  const { frame, index, tapped, pressKey } = useFrames(NAV, 4);
  return (
    <Mock>
      <span key={frame.tab} className="tut-abs tut-panel" style={{ left: 0, top: 0, width: W, height: NAV_TOP }}>
        <NavPanel tab={frame.tab} />
      </span>
      <span className="tut-abs tut-nav" style={box({ x: 0, y: NAV_TOP, w: W, h: H - NAV_TOP })} />
      {TABS.map(({ label, icon: Icon }, i) => {
        const key = NAV_KEYS[i];
        return (
          <span
            key={key ? pressKey(key) : label}
            className={cx('tut-abs tut-nav__item', frame.tab === i && 'is-active', key && tapped(key) && 'is-pressed')}
            style={box(tabRect(i))}
          >
            <Icon size={13} strokeWidth={1.75} />
            {label}
          </span>
        );
      })}
      <Finger at={frame.on && NAV_POS[frame.on]} tap={frame.tap} index={index} rest={{ x: 200, y: 96 }} />
    </Mock>
  );
}

function NavPanel({ tab }: { tab: number }) {
  if (tab === 1) {
    return (
      <>
        <span className="tut-dates">
          {['SEN', 'SEL', 'RAB', 'KAM', 'JUM'].map((d, i) => (
            <span key={d} className={i === 3 ? 'tut-date is-selected' : 'tut-date'}>
              <small>{d}</small>
              {14 + i}
            </span>
          ))}
        </span>
        <span className="tut-row">
          <span>Bench Press</span>
          <span className="muted">3 set</span>
        </span>
        <span className="tut-row">
          <span>Treadmill</span>
          <span className="muted">20 mnt</span>
        </span>
      </>
    );
  }
  if (tab === 2) {
    return (
      <>
        <span className="tut-panel__title">Statistik</span>
        <span className="tut-heat">
          {HEAT.map((level, i) => (
            <span key={i} className="tut-heat__cell" data-level={level} />
          ))}
        </span>
      </>
    );
  }
  if (tab === 3) {
    return (
      <>
        <span className="tut-row">
          <span className="muted">Tema</span>
          <b>Otomatis</b>
        </span>
        <span className="tut-row tut-row--btn">Lihat tutorial</span>
      </>
    );
  }
  return (
    <span className="tut-mini-tiles">
      {['Bench Press', 'Squat', 'Lat Pulldown', 'Chest Press', 'Treadmill'].map((n) => (
        <span key={n} className="tut-mini-tile">
          {n}
        </span>
      ))}
      <span className="tut-mini-tile is-active">
        <Plus size={14} strokeWidth={1.75} />
      </span>
    </span>
  );
}

/* ---------- 7. Offline lalu sinkron ---------- */

type SyncFrame = Frame<never> & { state: 'offline' | 'syncing' | 'done' };
const SYNC: SyncFrame[] = [
  { ms: 1600, state: 'offline' },
  { ms: 1500, state: 'syncing' },
  { ms: 1900, state: 'done' },
];
const SYNC_TEXT = { offline: 'Offline · 2 tersimpan di HP', syncing: 'Menyinkronkan…', done: 'Tersinkron' };

export function DemoSync() {
  const { frame } = useFrames(SYNC, 2);
  const { state } = frame;
  const CloudIcon = state === 'offline' ? CloudOff : state === 'syncing' ? Cloud : CloudCheck;
  return (
    <Mock>
      <span className="tut-abs tut-device" style={box({ x: 34, y: 40, w: 66, h: 66 })}>
        <Smartphone size={26} strokeWidth={1.75} />
        {state !== 'done' && <span className="tut-device__badge num">2</span>}
      </span>
      <span
        className={cx('tut-abs tut-link', state === 'done' && 'is-done')}
        style={box({ x: 108, y: 72, w: 56, h: 2 })}
      >
        {state === 'syncing' && (
          <>
            <span className="tut-link__dot" />
            <span className="tut-link__dot" />
          </>
        )}
      </span>
      <span
        className={cx('tut-abs tut-device', state === 'offline' && 'is-off')}
        style={box({ x: 172, y: 40, w: 66, h: 66 })}
      >
        <CloudIcon key={state} size={26} strokeWidth={1.75} />
      </span>
      <span className="tut-abs tut-info tut-info--label" style={box({ x: 34, y: 112, w: 66, h: 16 })}>
        HP
      </span>
      <span className="tut-abs tut-info tut-info--label" style={box({ x: 172, y: 112, w: 66, h: 16 })}>
        Cloud
      </span>
      <span key={state} className="tut-abs tut-status" style={box({ x: 16, y: 146, w: 240, h: 34 })}>
        {state === 'syncing' && <RefreshCw className="tut-spin" size={14} strokeWidth={1.75} />}
        {state === 'done' && <Check size={14} strokeWidth={1.75} />}
        {SYNC_TEXT[state]}
      </span>
    </Mock>
  );
}
