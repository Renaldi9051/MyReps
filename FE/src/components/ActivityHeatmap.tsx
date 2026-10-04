import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { useFirstActivityYear, useYearActivity, type ActivityGroup } from '../features/workout/queries';
import { formatGroupSummary, formatLongDate, formatMonthYear } from '../lib/format';
import { addDays, localDate, parseLocalDate, startOfWeek } from '../lib/time';

type View = 'bulan' | 'tahun';
type Popup = { date: string; left: number; top: number; above: boolean };

const DAY_LABELS = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const LEVELS = [0, 1, 2, 3, 4] as const;
const POPUP_W = 232; // sama dengan lebar .heat-pop di app.css
const EMPTY = new Map<string, ActivityGroup[]>();

const pad = (n: number) => String(n).padStart(2, '0');

// Makin banyak latihan berbeda di hari itu, makin pekat kotaknya (terang di mode gelap)
const levelOf = (count: number) => (count === 0 ? 0 : count <= 2 ? count : count <= 4 ? 3 : 4);

// Kolom = minggu (Senin..Minggu), baris = hari, seperti grafik kontribusi GitHub
function buildWeeks(from: string, to: string): string[][] {
  const weeks: string[][] = [];
  for (let start = startOfWeek(from); start <= to; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

// Heatmap aktivitas di Progres: satu kotak = satu hari. Tampilan bulan (default) atau setahun penuh.
// Tap kotak membuka pop up kecil berisi latihan di hari itu.
export function ActivityHeatmap() {
  const today = localDate();
  const now = parseLocalDate(today);
  const thisYear = now.getFullYear();
  const [view, setView] = useState<View>('bulan');
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(now.getMonth());
  const [popup, setPopup] = useState<Popup | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const firstYear = Math.min(useFirstActivityYear() ?? thisYear, thisYear);
  const activity = useYearActivity(year);
  const days = activity?.year === year ? activity.days : EMPTY;

  const yearly = view === 'tahun';
  const from = yearly ? `${year}-01-01` : `${year}-${pad(month + 1)}-01`;
  // Setahun untuk tahun ini berhenti di minggu ini (seperti GitHub), jadi tidak ada kolom kosong di kanan
  const to = yearly ? (year === thisYear ? today : `${year}-12-31`) :`${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
  const weeks = buildWeeks(from, to);
  const activeDays = [...days.keys()].filter((d) => d >= from && d <= to).length;
  const title = yearly ? String(year) : formatMonthYear(year, month);

  const canPrev = yearly ? year > firstYear : year > firstYear || month > 0;
  const canNext = yearly ? year < thisYear : year < thisYear || month < now.getMonth();

  const shift = (delta: 1 | -1) => {
    setPopup(null);
    if (yearly) {
      setYear(year + delta);
      return;
    }
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const changeView = (next: View) => {
    setPopup(null);
    setView(next);
    // Dari tampilan tahun ini kembali ke bulan: jangan sampai bulan yang belum datang
    if (next === 'bulan' && year === thisYear && month > now.getMonth()) setMonth(now.getMonth());
  };

  // Setahun penuh lebih lebar dari layar: tahun ini langsung digeser ke minggu terbaru
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = yearly && year === thisYear ? el.scrollWidth : 0;
  }, [yearly, year, thisYear]);

  // Tutup pop up saat tap di luar atau tekan Escape
  useEffect(() => {
    if (!popup) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (popRef.current?.contains(target) || target.closest('.heat-cell')) return;
      setPopup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popup]);

  const openDay = (date: string, row: number, e: MouseEvent<HTMLButtonElement>) => {
    if (popup?.date === date || !wrapRef.current) {
      setPopup(null);
      return;
    }
    const box = wrapRef.current.getBoundingClientRect();
    const cell = e.currentTarget.getBoundingClientRect();
    // Baris atas: pop up di bawah kotak; baris bawah: di atas kotak
    const above = row >= 3;
    const center = cell.left + cell.width / 2 - box.left;
    setPopup({
      date,
      left: Math.max(0, Math.min(center - POPUP_W / 2, box.width - POPUP_W)),
      top: above ? cell.top - box.top - 6 : cell.bottom - box.top + 6,
      above,
    });
  };

  const topLabel = (week: string[]) => {
    if (yearly) {
      const first = week.find((d) => d.endsWith('-01') && d >= from && d <= to);
      return first ? MONTH_SHORT[Number(first.slice(5, 7)) - 1] : '';
    }
    const first = week.find((d) => d >= from && d <= to);
    return first ? String(Number(first.slice(8))) : '';
  };

  const groups = popup ? (days.get(popup.date) ?? []) : [];

  return (
    <div className="heat" ref={wrapRef}>
      <div className="heat-head">
        <div className="heat-toggle" role="group" aria-label="Rentang statistik">
          {(['bulan', 'tahun'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? 'choice is-active' : 'choice'}
              aria-pressed={view === v}
              onClick={() => changeView(v)}
            >
              {v === 'bulan' ? 'Bulan' : 'Setahun'}
            </button>
          ))}
        </div>
        <span className="small">latihan per hari</span>
      </div>

      <div className="cal-nav">
        <button
          type="button"
          className="cal-nav__arrow"
          aria-label={yearly ? 'Tahun sebelumnya' : 'Bulan sebelumnya'}
          disabled={!canPrev}
          onClick={() => shift(-1)}
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="cal-nav__title num">{title}</span>
        <button
          type="button"
          className="cal-nav__arrow"
          aria-label={yearly ? 'Tahun berikutnya' : 'Bulan berikutnya'}
          disabled={!canNext}
          onClick={() => shift(1)}
        >
          <ChevronRight size={20} strokeWidth={1.75} />
        </button>
      </div>

      <div className="chart heat-box">
        <div className="heat-scroll" ref={scrollRef} onScroll={() => setPopup(null)}>
          <div className={yearly ? 'heat-grid heat-grid--year' : 'heat-grid'} role="group" aria-label={`Aktivitas ${title}`}>
            <span className="heat-grid__day" />
            {DAY_LABELS.map((label, i) => (
              <span key={label} className="heat-grid__day" aria-hidden>
                {yearly && i % 2 === 1 ? '' : label}
              </span>
            ))}
            {weeks.map((week) => [
              <span key={`top-${week[0]}`} className="heat-grid__top num" aria-hidden>
                {topLabel(week)}
              </span>,
              ...week.map((date, row) => {
                if (date < from || date > to) return <span key={date} className="heat-cell is-blank" />;
                if (date > today) {
                  return <span key={date} className={yearly ? 'heat-cell is-blank' : 'heat-cell is-future'} />;
                }
                const count = days.get(date)?.length ?? 0;
                const open = popup?.date === date;
                return (
                  <button
                    key={date}
                    type="button"
                    className={open ? 'heat-cell is-open' : 'heat-cell'}
                    data-level={levelOf(count)}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-label={`${formatLongDate(date)}, ${count > 0 ? `${count} latihan` : 'tidak ada latihan'}`}
                    onClick={(e) => openDay(date, row, e)}
                  />
                );
              }),
            ])}
          </div>
        </div>

        <div className="heat-foot">
          <span className="num">{activeDays > 0 ? `${activeDays} hari latihan` : 'Belum ada latihan.'}</span>
          <span className="heat-legend" aria-hidden>
            Sedikit
            {LEVELS.map((l) => (
              <span key={l} className="heat-legend__box" data-level={l} />
            ))}
            Banyak
          </span>
        </div>
      </div>

      {popup && (
        <div
          ref={popRef}
          className={popup.above ? 'heat-pop heat-pop--above' : 'heat-pop'}
          style={{ left: popup.left, top: popup.top }}
          role="dialog"
          aria-label={formatLongDate(popup.date)}
        >
          <p className="heat-pop__date">{formatLongDate(popup.date)}</p>
          {groups.length === 0 ? (
            <p className="heat-pop__empty">Tidak ada latihan.</p>
          ) : (
            <>
              <ul className="heat-pop__list">
                {groups.map((g) => (
                  <li key={g.exercise.id}>
                    <span>{g.exercise.name}</span>
                    <span className="num">{formatGroupSummary(g.sets)}</span>
                  </li>
                ))}
              </ul>
              <Link to={`/riwayat?tanggal=${popup.date}`} className="text-btn heat-pop__link">
                Buka di Riwayat
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
