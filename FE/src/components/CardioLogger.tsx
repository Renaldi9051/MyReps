import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { LocalExercise, WorkoutSet } from '../db/types';
import { addSet } from '../features/workout/actions';
import { useDraft } from '../features/workout/draft';
import { useExerciseSetCount, useLastSet, useTodaySets } from '../features/workout/queries';
import { useStopwatch } from '../features/workout/stopwatch';
import { haptic, useWakeLock } from '../lib/device';
import { formatDuration, formatNumber, formatSet, formatSpeed } from '../lib/format';
import { DEFAULT_SPEED, MINUTE, canInc, stepIncline, stepSpeed } from '../lib/steps';
import { nowIso } from '../lib/time';
import { AppHeader } from './AppHeader';
import { ExerciseEditSheet } from './ExerciseEditSheet';
import { SaveConfirmSheet } from './SaveConfirmSheet';
import { SetRows } from './SetRows';
import { Stepper } from './Stepper';
import { useToast } from './Toast';
import { useEndSession } from './useEndSession';

type SetValues = Pick<WorkoutSet, 'reps' | 'weight_kg' | 'per_hand' | 'duration_sec' | 'incline_pct' | 'speed_kmh'>;

// Field yang tidak ada = belum diubah user
const EMPTY_DRAFT: { incline?: number | null; speed?: number } = {};

// Varian kardio penghitung (DESIGN §6.3, PRD F6): stopwatch Mulai/Stop, koreksi ±1 menit,
// incline dan speed lewat stepper.
export function CardioLogger({ exercise }: { exercise: LocalExercise }) {
  const navigate = useNavigate();
  const lastSet = useLastSet(exercise.id);
  // Catatan yang sudah disimpan sebelum layar ini dibuka tidak ditampilkan lagi: tiap buka mulai dari Set 1.
  // Edit catatan lama lewat Riwayat.
  const [openedAt] = useState(nowIso);
  const visitSets = (useTodaySets(exercise.id) ?? []).filter((s) => s.created_at >= openedAt);
  const stopwatch = useStopwatch(exercise.id);
  const endSession = useEndSession();
  const toast = useToast();

  // F6.3/F6.4: nilai awal = sesi kardio sebelumnya. Incline/speed yang belum disimpan tetap ada
  // saat layar ditinggal (waktu disimpan oleh stopwatch).
  const [draft, setDraft] = useDraft(exercise.id, EMPTY_DRAFT);
  const incline = draft.incline !== undefined ? draft.incline : (lastSet?.incline_pct ?? null);
  const speed = draft.speed ?? lastSet?.speed_kmh ?? DEFAULT_SPEED;

  // Nilai yang dibekukan saat tombol Simpan ditekan, menunggu konfirmasi
  const [confirming, setConfirming] = useState<SetValues | null>(null);
  const [editingExercise, setEditingExercise] = useState(false);
  const setCount = useExerciseSetCount(exercise.id) ?? 0;

  useWakeLock(true);

  const setNumber = visitSets.length + 1;
  const elapsedSec = Math.floor(stopwatch.elapsedMs / 1000);
  const current = {
    reps: null,
    weight_kg: null,
    per_hand: false,
    duration_sec: elapsedSec,
    incline_pct: incline,
    speed_kmh: speed,
  };

  const askSave = () => {
    if (elapsedSec < 1) return;
    setConfirming(current);
  };

  const save = async (values: SetValues) => {
    setConfirming(null);
    const set = await addSet(exercise.id, values);
    haptic(20);
    toast({ message: `Set ${setNumber} tersimpan · ${formatSet(set)}`, durationMs: 3000 });
    stopwatch.reset();
    setDraft(EMPTY_DRAFT);
  };

  return (
    <>
      <AppHeader
        label={exercise.name}
        back={{ to: '/latihan', label: 'Kembali ke daftar latihan' }}
        menu={[
          // Latihan buatan sendiri bisa langsung dibetulkan (mis. salah ketik nama)
          ...(exercise.is_custom ? [{ label: 'Edit latihan ini', onSelect: () => setEditingExercise(true) }] : []),
          ...(endSession.item ? [endSession.item] : []),
        ]}
      />

      <main className="screen__body counter">
        <p className="counter__info num">
          Set {setNumber} · {lastSet ? `sesi lalu ${formatSet(lastSet)}` : 'sesi pertama'}
        </p>

        <div className="counter__ring-area">
          <div className="ring" role="timer" aria-label={`Waktu ${formatDuration(elapsedSec)}`}>
            <span className="ring__value ring__value--time">{formatDuration(elapsedSec)}</span>
            <span className="ring__label">waktu</span>
          </div>
        </div>

        <div className="counter__controls">
          <div className="rep-row">
            <button
              type="button"
              className="round round--minus round--time"
              aria-label="Kurangi 1 menit"
              disabled={elapsedSec < 1}
              onClick={() => {
                stopwatch.adjust(-MINUTE * 1000);
                haptic(10);
              }}
            >
              −1<small>mnt</small>
            </button>
            <button
              type="button"
              className="round round--plus round--start"
              onClick={() => {
                stopwatch.toggle();
                haptic(10);
              }}
            >
              {stopwatch.running ? 'Stop' : 'Mulai'}
            </button>
            <button
              type="button"
              className="round round--minus round--time"
              aria-label="Tambah 1 menit"
              onClick={() => {
                stopwatch.adjust(MINUTE * 1000);
                haptic(10);
              }}
            >
              +1<small>mnt</small>
            </button>
          </div>
          <Stepper
            label="Incline"
            value={incline === null ? 'tanpa' : `${formatNumber(incline)}%`}
            onDec={() => setDraft((d) => ({ ...d, incline: stepIncline(d.incline !== undefined ? d.incline : incline, -1) }))}
            onInc={() => setDraft((d) => ({ ...d, incline: stepIncline(d.incline !== undefined ? d.incline : incline, 1) }))}
            canDec={incline !== null}
            canInc={canInc.incline(incline)}
          />
          <Stepper
            label="Speed"
            value={`${formatSpeed(speed)} km/j`}
            onDec={() => setDraft((d) => ({ ...d, speed: stepSpeed(d.speed ?? speed, -1) }))}
            onInc={() => setDraft((d) => ({ ...d, speed: stepSpeed(d.speed ?? speed, 1) }))}
            canDec={speed > 0}
            canInc={canInc.speed(speed)}
          />

          <SetRows sets={visitSets} running={formatSet(current)} />

          <button type="button" className="btn btn--primary" disabled={elapsedSec < 1} onClick={askSave}>
            Simpan
          </button>
        </div>
      </main>

      {confirming && (
        <SaveConfirmSheet
          title={`Simpan set ${setNumber}?`}
          detail={formatSet(confirming)}
          onConfirm={() => void save(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
      {editingExercise && (
        <ExerciseEditSheet
          exercise={exercise}
          setCount={setCount}
          onClose={() => setEditingExercise(false)}
          onDeleted={() => navigate('/latihan', { replace: true })}
        />
      )}
      {endSession.sheet}
    </>
  );
}
