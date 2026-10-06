import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { LocalExercise, WorkoutSet } from '../db/types';
import { addSet } from '../features/workout/actions';
import { useDraft } from '../features/workout/draft';
import { useExerciseSetCount, useLastSet, useTodaySets } from '../features/workout/queries';
import { haptic, useWakeLock } from '../lib/device';
import { formatSet, formatWeight } from '../lib/format';
import { nowIso } from '../lib/time';
import { canInc, stepWeight } from '../lib/steps';
import { AppHeader } from './AppHeader';
import { ExerciseEditSheet } from './ExerciseEditSheet';
import { SaveConfirmSheet } from './SaveConfirmSheet';
import { SetRows } from './SetRows';
import { Stepper } from './Stepper';
import { useToast } from './Toast';
import { useEndSession } from './useEndSession';

type SetValues = Pick<WorkoutSet, 'reps' | 'weight_kg' | 'per_hand' | 'duration_sec' | 'incline_pct' | 'speed_kmh'>;

// weight/perHand null = belum diubah user
const EMPTY_DRAFT: { reps: number; weight: number | null; perHand: boolean | null } = {
  reps: 0,
  weight: null,
  perHand: null,
};

// Penghitung rep (DESIGN §6.3, PRD F2 & F3.1). Set berikutnya cukup: +1 beberapa kali, lalu Simpan set.
export function StrengthLogger({ exercise }: { exercise: LocalExercise }) {
  const navigate = useNavigate();
  const lastSet = useLastSet(exercise.id);
  // Set yang sudah disimpan sebelum layar ini dibuka tidak ditampilkan lagi: tiap buka mulai dari Set 1.
  // Edit set lama lewat Riwayat.
  const [openedAt] = useState(nowIso);
  const visitSets = (useTodaySets(exercise.id) ?? []).filter((s) => s.created_at >= openedAt);
  const endSession = useEndSession();
  const toast = useToast();

  // Rep dan beban yang belum disimpan tetap ada saat layar ditinggal lalu dibuka lagi
  const [draft, setDraft] = useDraft(exercise.id, EMPTY_DRAFT);
  const reps = draft.reps;
  const setReps = (update: (r: number) => number) => setDraft((d) => ({ ...d, reps: update(d.reps) }));
  // F2.4: beban awal = beban set sebelumnya di latihan ini, 0 kalau belum ada
  const weight = draft.weight ?? lastSet?.weight_kg ?? 0;
  const stepDraftWeight = (dir: 1 | -1) => setDraft((d) => ({ ...d, weight: stepWeight(d.weight ?? weight, dir) }));
  // Pisah beban kiri + kanan (dumbbell): ikut set sebelumnya di latihan ini
  const perHand = draft.perHand ?? lastSet?.per_hand ?? false;

  // Nilai yang dibekukan saat tombol Simpan ditekan, menunggu konfirmasi
  const [confirming, setConfirming] = useState<SetValues | null>(null);
  const [editingExercise, setEditingExercise] = useState(false);
  const setCount = useExerciseSetCount(exercise.id) ?? 0;
  // Animasi: arah perubahan rep terakhir dan jumlah tap +1 (key riak dan denyut cincin)
  const [repDir, setRepDir] = useState<1 | -1 | 0>(0);
  const [plusTaps, setPlusTaps] = useState(0);

  useWakeLock(true);

  const setNumber = visitSets.length + 1;

  const askSave = () => {
    if (reps === 0) return;
    setConfirming({
      reps,
      weight_kg: weight,
      per_hand: perHand,
      duration_sec: null,
      incline_pct: null,
      speed_kmh: null,
    });
  };

  const save = async (values: SetValues) => {
    setConfirming(null);
    const set = await addSet(exercise.id, values);
    haptic(20);
    toast({ message: `Set ${setNumber} tersimpan · ${formatSet(set)}`, durationMs: 3000 });
    // Beban tetap sama untuk set berikutnya
    setDraft({ reps: 0, weight: values.weight_kg, perHand: values.per_hand });
    setRepDir(-1);
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
          Set {setNumber} · {lastSet ? `set lalu ${formatSet(lastSet)}` : 'set pertama'}
        </p>

        <div className="counter__ring-area">
          <div className="ring" aria-live="polite" aria-label={`${reps} rep`}>
            {/* Denyut cincin tiap +1 */}
            {plusTaps > 0 && <span key={`beat-${plusTaps}`} className="ring__beat" aria-hidden />}
            <span key={reps} className={repDir === 0 ? 'ring__value' : repDir === 1 ? 'ring__value is-up' : 'ring__value is-down'}>
              {reps}
            </span>
            <span className="ring__label">rep</span>
          </div>
        </div>

        <div className="counter__controls">
          <div className="rep-row">
            <button
              type="button"
              className="round round--minus"
              aria-label="Kurangi 1 rep"
              disabled={reps === 0}
              onClick={() => {
                setReps((r) => Math.max(0, r - 1));
                setRepDir(-1);
                haptic(10);
              }}
            >
              −1
            </button>
            {/* Riak lime keluar dari belakang tombol tiap tap */}
            <span className="plus-wrap">
              {plusTaps > 0 && <span key={plusTaps} className="round__ripple" aria-hidden />}
              <button
                type="button"
                className="round round--plus"
                aria-label="Tambah 1 rep"
                onClick={() => {
                  setReps((r) => r + 1);
                  setRepDir(1);
                  setPlusTaps((n) => n + 1);
                  haptic(10);
                }}
              >
                +1
              </button>
            </span>
            <button
              type="button"
              className="round round--minus round--time round--hand"
              aria-label="Pisah beban kiri dan kanan"
              aria-pressed={perHand}
              onClick={() => {
                setDraft((d) => ({ ...d, perHand: !perHand }));
                haptic(10);
              }}
            >
              Pisah
              <small>beban</small>
            </button>
          </div>

          <Stepper
            label="Beban"
            value={formatWeight(weight, perHand)}
            onDec={() => stepDraftWeight(-1)}
            onInc={() => stepDraftWeight(1)}
            canDec={weight > 0}
            canInc={canInc.weight(weight)}
          />

          <SetRows sets={visitSets} running={`${reps} × ${formatWeight(weight, perHand)}`} />

          <button type="button" className="btn btn--primary" disabled={reps === 0} onClick={askSave}>
            Simpan set
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
