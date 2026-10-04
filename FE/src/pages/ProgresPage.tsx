import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { AppHeader } from '../components/AppHeader';
import { LineChart } from '../components/LineChart';
import { Sheet } from '../components/Sheet';
import { ProgressRings } from '../components/WeekProgress';
import { useExerciseUsage, useExercises, useWeekGroupSessions, useWeeklyTrend } from '../features/workout/queries';

// Progres (DESIGN §6.5): heatmap aktivitas, grafik 6 minggu untuk satu latihan, cincin sesi minggu ini
export function ProgresPage() {
  const exercises = useExercises();
  const usage = useExerciseUsage();
  const week = useWeekGroupSessions();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // Latihan yang pernah dicatat, terbaru di atas; default: yang terakhir dipakai
  const used = (exercises ?? [])
    .filter((e) => usage?.has(e.id))
    .sort((a, b) => usage!.get(b.id)!.lastAt.localeCompare(usage!.get(a.id)!.lastAt));
  const exercise = used.find((e) => e.id === chosenId) ?? used[0] ?? null;
  const trend = useWeeklyTrend(exercise);
  const cardio = exercise?.type === 'kardio';

  return (
    <>
      <AppHeader label="Progres" />
      <main className="screen__body">
        <h2 className="section-rule progres-title">Statistik</h2>
        <ActivityHeatmap />

        {exercise ? (
          <>
            <div className="chart-head progres-trend">
              <button type="button" className="chart-picker" onClick={() => setPicking(true)}>
                {exercise.name}
                <ChevronDown size={16} strokeWidth={1.75} />
              </button>
              <span className="small">{cardio ? 'menit per minggu' : 'beban per minggu (kg)'}</span>
            </div>
            <div className="chart">
              {trend?.exerciseId === exercise.id && (
                <LineChart
                  points={trend.points}
                  subject={`${cardio ? 'Waktu' : 'Beban'} ${exercise.name}`}
                  unit={cardio ? 'menit' : 'kg'}
                />
              )}
            </div>
            <Link to={`/progres/latihan/${exercise.id}`} className="text-btn chart-link">
              Lihat semua catatan
            </Link>
          </>
        ) : (
          <p className="empty">Belum ada latihan tercatat. Mulai dari tab Latihan.</p>
        )}

        <div className="section-rule section-head progres-week">
          <span>Minggu ini</span>
          <span className="aside">sesi / target</span>
        </div>
        <ProgressRings counts={week ?? new Map()} />
      </main>

      {picking && (
        <Sheet title="Pilih latihan" onClose={() => setPicking(false)} tall>
          <ul className="ex-list">
            {used.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={e.id === exercise?.id ? 'ex-row is-open' : 'ex-row'}
                  onClick={() => {
                    setChosenId(e.id);
                    setPicking(false);
                  }}
                >
                  <span className="ex-row__name">{e.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
