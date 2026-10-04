import { CalendarDays, Check, ChevronDown, ChevronUp, Download, Pencil, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { CalendarSheet } from '../components/CalendarSheet';
import { DateStrip } from '../components/DateStrip';
import { DaySummaryCard } from '../components/DaySummaryCard';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';
import { SetEditSheet } from '../components/SetEditSheet';
import { useToast } from '../components/Toast';
import type { LocalExercise, LocalSet } from '../db/types';
import { changeExerciseInSession, deleteExerciseInSession } from '../features/workout/actions';
import { downloadDayPdf } from '../features/workout/pdf';
import { type DayGroup, useActiveDates, useDay, useDaySummary } from '../features/workout/queries';
import { formatDayMonth, formatGroupSummary, formatMonthYear, formatSet } from '../lib/format';
import { muscleLabel } from '../lib/labels';
import { localDate, parseLocalDate } from '../lib/time';

type Editing = { set: LocalSet; position: number; exercise: LocalExercise };

// Riwayat per tanggal (DESIGN §6.4, PRD F4 & F5)
export function RiwayatPage() {
  const [params, setParams] = useSearchParams();
  const today = localDate();
  const selected = params.get('tanggal') ?? today;
  const day = useDay(selected);
  const summary = useDaySummary(day?.groups, selected);
  const activeDates = useActiveDates();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [swapping, setSwapping] = useState<DayGroup | null>(null);
  const [exporting, setExporting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const toast = useToast();

  const select = (date: string) => {
    setOpenKey(null);
    setParams(date === today ? {} : { tanggal: date }, { replace: true });
  };

  const remove = async (g: DayGroup) => {
    const undo = await deleteExerciseInSession(g.sessionId, g.exercise.id);
    setOpenKey(null);
    toast({ message: `${g.exercise.name} dihapus`, actionLabel: 'Urungkan', onAction: () => void undo() });
  };

  // F5.2: semua set latihan ini di hari itu pindah ke latihan lain
  const swap = async (g: DayGroup, target: LocalExercise) => {
    await changeExerciseInSession(g.sessionId, g.exercise.id, target.id);
    setSwapping(null);
    setOpenKey(null);
    toast({ message: `Dipindah ke ${target.name}` });
  };

  const exportPdf = async () => {
    if (!day || !summary) return;
    setExporting(true);
    try {
      await downloadDayPdf(selected, day.groups, summary);
    } catch {
      toast({ message: 'Gagal membuat PDF' });
    } finally {
      setExporting(false);
    }
  };

  const selectedDate = parseLocalDate(selected);
  const groups = day?.groups ?? [];
  const muscles = [...new Set(groups.map((g) => g.exercise.muscle_group))].map(muscleLabel);
  const exerciseCount = new Set(groups.map((g) => g.exercise.id)).size;

  return (
    <>
      <AppHeader label="Riwayat" />
      <main className="screen__body">
        <div className="month-bar">
          <button
            type="button"
            className="month-btn"
            aria-label={`Buka kalender, ${formatMonthYear(selectedDate.getFullYear(), selectedDate.getMonth())}`}
            onClick={() => setCalendarOpen(true)}
          >
            <CalendarDays size={18} strokeWidth={1.75} />
            {formatMonthYear(selectedDate.getFullYear(), selectedDate.getMonth())}
            <ChevronDown size={16} strokeWidth={1.75} />
          </button>
        </div>
        <DateStrip selected={selected} onSelect={select} activeDates={activeDates ?? new Set()} />

        <div className="day-head">
          <h2>{muscles.length > 0 ? muscles.join(', ') : formatDayMonth(selected)}</h2>
          {groups.length > 0 && (
            <div className="day-head__meta">
              <span className="num">
                {exerciseCount} latihan · {day?.setCount} set
              </span>
              {summary && (
                <button
                  type="button"
                  className="pdf-btn"
                  aria-label={`Unduh PDF latihan ${formatDayMonth(selected)}`}
                  disabled={exporting}
                  onClick={() => void exportPdf()}
                >
                  <Download size={14} strokeWidth={1.75} />
                  PDF
                </button>
              )}
            </div>
          )}
        </div>

        {summary && <DaySummaryCard key={`ringkasan-${selected}`} summary={summary} />}

        {day && groups.length === 0 && <p className="empty">Belum ada latihan.</p>}

        <ul key={`daftar-${selected}`} className="ex-list">
          {groups.map((g) => {
            const key = `${g.sessionId}|${g.exercise.id}`;
            const open = openKey === key;
            return (
              <Fragment key={key}>
                <li className="ex-item">
                  <button
                    type="button"
                    className={open ? 'ex-row is-open' : 'ex-row'}
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : key)}
                  >
                    <span className="ex-row__name">{g.exercise.name}</span>
                    {open ? (
                      <ChevronUp size={18} strokeWidth={1.75} />
                    ) : (
                      <>
                        <span className="ex-row__meta">{formatGroupSummary(g.sets)}</span>
                        <Check size={20} strokeWidth={1.75} />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="ex-item__icon"
                    aria-label={`Ganti latihan ${g.exercise.name}`}
                    onClick={() => setSwapping(g)}
                  >
                    <Pencil size={18} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className="ex-item__icon"
                    aria-label={`Hapus ${g.exercise.name} dari riwayat`}
                    onClick={() => void remove(g)}
                  >
                    <Trash2 size={18} strokeWidth={1.75} />
                  </button>
                </li>
                {open && (
                  <li className="set-list">
                    {g.sets.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        className="set-row set-row--tap"
                        aria-label={`Edit set ${i + 1}: ${formatSet(s)}`}
                        onClick={() => setEditing({ set: s, position: i + 1, exercise: g.exercise })}
                      >
                        <span>
                          <b>Set {i + 1}</b> · {formatSet(s)}
                        </span>
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                    ))}
                  </li>
                )}
              </Fragment>
            );
          })}
          {selected === today && (
            <li>
              <Link to="/latihan" className="ex-row ex-row--add">
                + Tambah latihan
              </Link>
            </li>
          )}
        </ul>
      </main>

      {calendarOpen && (
        <CalendarSheet
          selected={selected}
          activeDates={activeDates ?? new Set()}
          onSelect={(date) => {
            select(date);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
      {editing && (
        <SetEditSheet
          set={editing.set}
          position={editing.position}
          exerciseName={editing.exercise.name}
          type={editing.exercise.type}
          onClose={() => setEditing(null)}
        />
      )}
      {swapping && (
        <ExercisePickerSheet
          title={`Ganti ${swapping.exercise.name} (${swapping.sets.length} set) dengan…`}
          onlyType={swapping.exercise.type}
          excludeId={swapping.exercise.id}
          onPick={(e) => void swap(swapping, e)}
          onClose={() => setSwapping(null)}
        />
      )}
    </>
  );
}
