import { useState } from 'react';
import type { ExerciseType, LocalSet } from '../db/types';
import { deleteSet, updateSet } from '../features/workout/actions';
import { formatDuration, formatNumber, formatSpeed, formatWeight } from '../lib/format';
import { canInc, stepDuration, stepIncline, stepSpeed, stepWeight } from '../lib/steps';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';
import { useToast } from './Toast';

type Props = {
  set: LocalSet;
  position: number;
  exerciseName: string;
  type: ExerciseType;
  onClose: () => void;
};

// F5: edit rep/beban (atau data kardio), hapus dengan "Urungkan" 5 detik.
// Ganti latihan dilakukan per latihan (semua set), dari baris latihan di Riwayat.
export function SetEditSheet({ set, position, exerciseName, type, onClose }: Props) {
  const toast = useToast();
  const [reps, setReps] = useState(set.reps ?? 0);
  const [weight, setWeight] = useState(set.weight_kg ?? 0);
  const [perHand, setPerHand] = useState(set.per_hand);
  const [duration, setDuration] = useState(set.duration_sec ?? 0);
  const [incline, setIncline] = useState(set.incline_pct);
  const [speed, setSpeed] = useState(set.speed_kmh ?? 0);

  const cardio = type === 'kardio';
  const valid = cardio ? duration > 0 : reps > 0;

  const save = async () => {
    await updateSet(
      set.id,
      cardio
        ? { duration_sec: duration, incline_pct: incline, speed_kmh: speed }
        : { reps, weight_kg: weight, per_hand: perHand },
    );
    onClose();
  };

  const remove = async () => {
    const undo = await deleteSet(set.id);
    onClose();
    toast({ message: `Set ${position} dihapus`, actionLabel: 'Urungkan', onAction: () => void undo() });
  };

  return (
    <Sheet title={`${exerciseName} · Set ${position}`} onClose={onClose}>
      <div className="stack">
        {cardio ? (
          <>
            <Stepper
              label="Waktu"
              value={formatDuration(duration)}
              onDec={() => setDuration((d) => stepDuration(d, -1))}
              onInc={() => setDuration((d) => stepDuration(d, 1))}
              canDec={duration > 0}
            />
            <Stepper
              label="Incline"
              value={incline === null ? 'tanpa' : `${formatNumber(incline)}%`}
              onDec={() => setIncline((p) => stepIncline(p, -1))}
              onInc={() => setIncline((p) => stepIncline(p, 1))}
              canDec={incline !== null}
              canInc={canInc.incline(incline)}
            />
            <Stepper
              label="Speed"
              value={`${formatSpeed(speed)} km/j`}
              onDec={() => setSpeed((s) => stepSpeed(s, -1))}
              onInc={() => setSpeed((s) => stepSpeed(s, 1))}
              canDec={speed > 0}
              canInc={canInc.speed(speed)}
            />
          </>
        ) : (
          <>
            <Stepper
              label="Rep"
              value={String(reps)}
              onDec={() => setReps((r) => Math.max(0, r - 1))}
              onInc={() => setReps((r) => r + 1)}
              canDec={reps > 0}
            />
            <Stepper
              label="Beban"
              value={formatWeight(weight, perHand)}
              onDec={() => setWeight((w) => stepWeight(w, -1))}
              onInc={() => setWeight((w) => stepWeight(w, 1))}
              canDec={weight > 0}
              canInc={canInc.weight(weight)}
            />
            <fieldset className="field">
              <legend className="field__label">Beban kiri dan kanan</legend>
              <div className="choice-grid choice-grid--2">
                {[
                  { value: false, label: 'Satu beban' },
                  { value: true, label: 'Pisah beban' },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    className={perHand === o.value ? 'choice is-active' : 'choice'}
                    aria-pressed={perHand === o.value}
                    onClick={() => setPerHand(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <button type="button" className="btn btn--primary" disabled={!valid} onClick={() => void save()}>
          Simpan
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => void remove()}>
          Hapus set
        </button>
      </div>
    </Sheet>
  );
}
