import { Plus } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';
import { useEndSession } from '../components/useEndSession';
import { SegmentBars } from '../components/WeekProgress';
import type { LocalExercise } from '../db/types';
import { syncNow } from '../features/sync/engine';
import { useSyncState } from '../features/sync/hooks';
import { useSyncLabel } from '../features/sync/useSyncLabel';
import { useExerciseUsage, useExercises, useWeekGroupSessions } from '../features/workout/queries';
import { useBootReady } from '../lib/boot';
import { formatDayMonth } from '../lib/format';
import { localDate } from '../lib/time';

const TILE_COUNT = 5;
// Isi kotak untuk pengguna baru yang belum punya riwayat (urutan sesuai canvas)
const STARTER = ['Bench Press', 'Squat', 'Lat Pulldown', 'Chest Press Machine', 'Treadmill'];

// Pilih latihan (DESIGN §6.2): 5 kotak latihan terakhir dipakai + tombol tambah, lalu "Minggu ini"
export function LatihanPage() {
  const navigate = useNavigate();
  const exercises = useExercises();
  const usage = useExerciseUsage();
  const week = useWeekGroupSessions();
  useBootReady(exercises !== undefined && usage !== undefined && week !== undefined);
  const sync = useSyncLabel();
  const endSession = useEndSession();
  const [picking, setPicking] = useState(false);

  const open = (e: LocalExercise) => navigate(`/latihan/${e.id}`);

  const tiles: LocalExercise[] = [];
  if (exercises && usage) {
    const recent = exercises
      .filter((e) => usage.has(e.id))
      .sort((a, b) => usage.get(b.id)!.lastAt.localeCompare(usage.get(a.id)!.lastAt));
    tiles.push(...recent.slice(0, TILE_COUNT));
    for (const name of STARTER) {
      if (tiles.length >= TILE_COUNT) break;
      const e = exercises.find((x) => x.name === name && !x.is_custom);
      if (e && !tiles.includes(e)) tiles.push(e);
    }
  }

  return (
    <>
      <AppHeader
        label="Latihan"
        menu={[
          ...(endSession.item ? [endSession.item] : []),
          { label: 'Buat latihan sendiri', onSelect: () => navigate('/latihan/tambah') },
          { label: 'Kelola latihan', onSelect: () => navigate('/latihan/kelola') },
        ]}
      />
      <main className="screen__body">
        <p className="subline">
          {formatDayMonth(localDate())}
          {!sync.synced && ` · ${sync.text}`}
        </p>

        {exercises && exercises.length === 0 ? (
          <EmptyExercises />
        ) : (
          <div className="tiles">
            {tiles.map((e, i) => (
              <button
                key={e.id}
                type="button"
                className="tile"
                style={{ '--i': i } as CSSProperties}
                onClick={() => open(e)}
              >
                {e.name}
              </button>
            ))}
            <button
              type="button"
              className="tile tile--add"
              style={{ '--i': tiles.length } as CSSProperties}
              aria-label="Tambah latihan"
              onClick={() => setPicking(true)}
            >
              <Plus size={26} strokeWidth={1.75} />
            </button>
          </div>
        )}

        <h2 className="section-rule week-title">Minggu ini</h2>
        <SegmentBars counts={week ?? new Map()} />
      </main>

      {picking && (
        <ExercisePickerSheet title="Pilih latihan" allowCreate onPick={open} onClose={() => setPicking(false)} />
      )}
      {endSession.sheet}
    </>
  );
}

// Latihan bawaan datang dari server saat sinkron pertama setelah login
function EmptyExercises() {
  const { status } = useSyncState();
  if (status === 'offline') return <p className="empty">Sambungkan internet sekali untuk memuat daftar latihan.</p>;
  if (status === 'unreachable') return <p className="empty">Server tidak bisa dihubungi. Daftar latihan dimuat begitu server tersambung.</p>;
  if (status === 'error') {
    return (
      <div className="empty">
        <p>Gagal memuat daftar latihan.</p>
        <button type="button" className="text-btn" onClick={() => void syncNow()}>
          Coba lagi
        </button>
      </div>
    );
  }
  return <p className="empty">Memuat daftar latihan…</p>;
}
