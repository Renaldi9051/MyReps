import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { AppHeader } from '../components/AppHeader';
import { ProgressRings } from '../components/WeekProgress';
import { useWeekGroupSessions } from '../features/workout/queries';

// Progres (DESIGN §6.5): heatmap aktivitas + cincin sesi minggu ini
export function ProgresPage() {
  const week = useWeekGroupSessions();

  return (
    <>
      <AppHeader label="Progres" />
      <main className="screen__body">
        <h2 className="section-rule progres-title">Statistik</h2>
        <ActivityHeatmap />

        <div className="section-rule section-head progres-week">
          <span>Minggu ini</span>
          <span className="aside">sesi / target</span>
        </div>
        <ProgressRings counts={week ?? new Map()} />
      </main>
    </>
  );
}
