import Dexie, { type EntityTable } from 'dexie';
import type { LocalExercise, LocalSession, LocalSet } from './types';

type Meta = { key: string; value: unknown };

// Semua layar membaca dan menulis ke sini dulu (offline-first); sinkron ke BE menyusul.
export const db = new Dexie('myrep') as Dexie & {
  exercises: EntityTable<LocalExercise, 'id'>;
  sessions: EntityTable<LocalSession, 'id'>;
  sets: EntityTable<LocalSet, 'id'>;
  meta: EntityTable<Meta, 'key'>;
};

db.version(1).stores({
  exercises: 'id, muscle_group, pending',
  sessions: 'id, date, pending',
  sets: 'id, session_id, [exercise_id+created_at], created_at, pending',
  meta: 'key',
});

// Set lama belum punya per_hand
db.version(2)
  .stores({})
  .upgrade((tx) =>
    tx
      .table('sets')
      .toCollection()
      .modify((s: { per_hand?: boolean }) => {
        s.per_hand ??= false;
      }),
  );

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function countPending(): Promise<number> {
  const counts = await Promise.all([
    db.exercises.where('pending').equals(1).count(),
    db.sessions.where('pending').equals(1).count(),
    db.sets.where('pending').equals(1).count(),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}

// F7.5: keluar akun menghapus semua data lokal
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', [db.exercises, db.sessions, db.sets, db.meta], async () => {
    await Promise.all([db.exercises.clear(), db.sessions.clear(), db.sets.clear(), db.meta.clear()]);
  });
}
