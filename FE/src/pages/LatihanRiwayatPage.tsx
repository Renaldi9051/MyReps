import { useState } from 'react';
import { useParams } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { SetEditSheet } from '../components/SetEditSheet';
import type { LocalSet } from '../db/types';
import { useExercise, useExerciseHistory } from '../features/workout/queries';
import { formatDateLabel, formatSetCompact } from '../lib/format';

// PRD F4.3: semua set satu latihan, per tanggal (dibuka dari nama latihan di pop up heatmap Progres)
export function LatihanRiwayatPage() {
  const { exerciseId } = useParams();
  const exercise = useExercise(exerciseId);
  const history = useExerciseHistory(exerciseId);
  const [editing, setEditing] = useState<{ set: LocalSet; position: number } | null>(null);

  if (exercise === undefined || history === undefined) return null;

  return (
    <>
      <AppHeader label={exercise?.name ?? 'Latihan'} back={{ to: '/progres', label: 'Kembali ke progres' }} />
      <main className="screen__body">
        {!exercise && <p className="empty">Latihan tidak ditemukan.</p>}
        {exercise && history.length === 0 && <p className="empty">Belum ada catatan untuk latihan ini.</p>}
        {exercise &&
          history.map((day) => (
            <section key={day.date}>
              <div className="day-head">
                <h2>{formatDateLabel(day.date)}</h2>
                <span className="num">{day.sets.length} set</span>
              </div>
              <div className="ex-detail__chips">
                {day.sets.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className="set-chip"
                    aria-label={`Edit set ${i + 1}`}
                    onClick={() => setEditing({ set: s, position: i + 1 })}
                  >
                    {formatSetCompact(s)}
                  </button>
                ))}
              </div>
            </section>
          ))}
      </main>

      {editing && exercise && (
        <SetEditSheet
          set={editing.set}
          position={editing.position}
          exerciseName={exercise.name}
          type={exercise.type}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
