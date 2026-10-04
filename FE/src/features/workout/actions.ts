import { db } from '../../db';
import type { LocalExercise, LocalSession, LocalSet, MuscleGroup, WorkoutSet } from '../../db/types';
import { localDate, nowIso } from '../../lib/time';
import { uuid } from '../../lib/uuid';
import { requestSync } from '../sync/engine';

// Semua perubahan ditulis ke Dexie dulu dengan pending=1, lalu sinkron dijadwalkan.

type SetValues = Pick<WorkoutSet, 'reps' | 'weight_kg' | 'per_hand' | 'duration_sec' | 'incline_pct' | 'speed_kmh'>;

const live = <T extends { deleted_at: string | null }>(row: T) => row.deleted_at === null;

// F3.2: satu sesi per hari, dibuat otomatis saat set pertama disimpan.
// Kalau sesi hari ini sudah ditutup lalu user mencatat lagi, sesi dibuka kembali.
async function todaySessionForWrite(now: string): Promise<LocalSession> {
  const today = localDate();
  const existing = (await db.sessions.where('date').equals(today).filter(live).sortBy('created_at'))[0];
  if (existing) {
    if (existing.ended_at === null) return existing;
    const reopened: LocalSession = { ...existing, ended_at: null, updated_at: now, pending: 1 };
    await db.sessions.put(reopened);
    return reopened;
  }
  const session: LocalSession = {
    id: uuid(),
    date: today,
    started_at: now,
    ended_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    pending: 1,
  };
  await db.sessions.add(session);
  return session;
}

// Nomor set = urutan set yang masih ada untuk latihan itu di sesi itu
async function renumber(sessionId: string, exerciseId: string, now: string): Promise<void> {
  const sets = await db.sets
    .where('session_id')
    .equals(sessionId)
    .filter((s) => live(s) && s.exercise_id === exerciseId)
    .sortBy('created_at');
  await Promise.all(
    sets.map((s, i) =>
      s.set_number === i + 1
        ? undefined
        : db.sets.put({ ...s, set_number: i + 1, updated_at: now, pending: 1 }),
    ),
  );
}

export async function addSet(exerciseId: string, values: SetValues): Promise<LocalSet> {
  const set = await db.transaction('rw', db.sessions, db.sets, async () => {
    const now = nowIso();
    const session = await todaySessionForWrite(now);
    const count = await db.sets
      .where('session_id')
      .equals(session.id)
      .filter((s) => live(s) && s.exercise_id === exerciseId)
      .count();
    const row: LocalSet = {
      id: uuid(),
      session_id: session.id,
      exercise_id: exerciseId,
      set_number: count + 1,
      ...values,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      pending: 1,
    };
    await db.sets.add(row);
    return row;
  });
  requestSync();
  return set;
}

// F5.1: edit rep/beban atau data kardio
export async function updateSet(id: string, values: Partial<SetValues>): Promise<void> {
  await db.sets.update(id, { ...values, updated_at: nowIso(), pending: 1 });
  requestSync();
}

// F5.3: hapus lunak; kembalikan fungsi "Urungkan"
export async function deleteSet(id: string): Promise<() => Promise<void>> {
  await setDeleted(id, true);
  return () => setDeleted(id, false);
}

async function setDeleted(id: string, deleted: boolean): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const set = await db.sets.get(id);
    if (!set) return;
    const now = nowIso();
    await db.sets.put({ ...set, deleted_at: deleted ? now : null, updated_at: now, pending: 1 });
    await renumber(set.session_id, set.exercise_id, now);
  });
  requestSync();
}

// Riwayat: hapus lunak semua set satu latihan di satu sesi; kembalikan fungsi "Urungkan"
export async function deleteExerciseInSession(sessionId: string, exerciseId: string): Promise<() => Promise<void>> {
  const ids = await db.transaction('rw', db.sets, async () => {
    const now = nowIso();
    const sets = await db.sets
      .where('session_id')
      .equals(sessionId)
      .filter((s) => live(s) && s.exercise_id === exerciseId)
      .toArray();
    await db.sets.bulkPut(sets.map((s) => ({ ...s, deleted_at: now, updated_at: now, pending: 1 as const })));
    return sets.map((s) => s.id);
  });
  requestSync();
  return async () => {
    await db.transaction('rw', db.sets, async () => {
      const now = nowIso();
      const sets = (await db.sets.bulkGet(ids)).filter((s): s is LocalSet => s !== undefined);
      await db.sets.bulkPut(sets.map((s) => ({ ...s, deleted_at: null, updated_at: now, pending: 1 as const })));
      await renumber(sessionId, exerciseId, now);
    });
    requestSync();
  };
}

// F5.2: pindahkan set ke latihan lain (semua set latihan itu di satu sesi)
export async function changeExercise(setIds: string[], newExerciseId: string): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const now = nowIso();
    const sets = (await db.sets.bulkGet(setIds)).filter((s): s is LocalSet => s !== undefined);
    const touched = new Set<string>();
    for (const s of sets) {
      touched.add(`${s.session_id}|${s.exercise_id}`);
      touched.add(`${s.session_id}|${newExerciseId}`);
      await db.sets.put({ ...s, exercise_id: newExerciseId, updated_at: now, pending: 1 });
    }
    for (const key of touched) {
      const [sessionId, exerciseId] = key.split('|') as [string, string];
      await renumber(sessionId, exerciseId, now);
    }
  });
  requestSync();
}

// F5.2: semua set latihan `fromId` di sesi itu pindah ke `toId`
export async function changeExerciseInSession(sessionId: string, fromId: string, toId: string): Promise<void> {
  const sets = await db.sets
    .where('session_id')
    .equals(sessionId)
    .filter((s) => live(s) && s.exercise_id === fromId)
    .toArray();
  await changeExercise(
    sets.map((s) => s.id),
    toId,
  );
}

export type SessionSummary = { exercises: number; sets: number; reps: number };

export async function summarizeSession(sessionId: string): Promise<SessionSummary> {
  const sets = await db.sets.where('session_id').equals(sessionId).filter(live).toArray();
  return {
    exercises: new Set(sets.map((s) => s.exercise_id)).size,
    sets: sets.length,
    reps: sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
  };
}

// F3.3: tutup sesi dan kembalikan ringkasannya
export async function endSession(sessionId: string): Promise<SessionSummary> {
  const now = nowIso();
  await db.sessions.update(sessionId, { ended_at: now, updated_at: now, pending: 1 });
  requestSync();
  return summarizeSession(sessionId);
}

export class DuplicateExerciseError extends Error {}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

// Nama latihan unik (tanpa beda huruf besar/kecil) di antara latihan yang masih ada
async function assertUniqueName(name: string, exceptId?: string): Promise<void> {
  const lower = name.toLocaleLowerCase('id-ID');
  const duplicate = await db.exercises
    .filter((e) => live(e) && e.id !== exceptId && e.name.toLocaleLowerCase('id-ID') === lower)
    .first();
  if (duplicate) throw new DuplicateExerciseError(`"${duplicate.name}" sudah ada di daftar`);
}

// F1.4: latihan custom, langsung bisa dipilih
export async function addCustomExercise(name: string, group: MuscleGroup): Promise<LocalExercise> {
  const trimmed = cleanName(name);
  const exercise = await db.transaction('rw', db.exercises, async () => {
    await assertUniqueName(trimmed);
    const now = nowIso();
    const row: LocalExercise = {
      id: uuid(),
      user_id: null, // diisi server saat sinkron
      name: trimmed,
      type: group === 'kardio' ? 'kardio' : 'beban',
      muscle_group: group,
      is_custom: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      pending: 1,
    };
    await db.exercises.add(row);
    return row;
  });
  requestSync();
  return exercise;
}

// Kelola latihan: ganti nama / kelompok otot latihan buatan sendiri.
// Tipe (beban/kardio) tidak berubah supaya set yang sudah tercatat tetap cocok.
export async function updateCustomExercise(id: string, name: string, group: MuscleGroup): Promise<void> {
  const trimmed = cleanName(name);
  await db.transaction('rw', db.exercises, async () => {
    const exercise = await db.exercises.get(id);
    if (!exercise || !exercise.is_custom) throw new Error('Latihan bawaan tidak bisa diubah');
    if ((group === 'kardio') !== (exercise.type === 'kardio')) {
      throw new Error('Kelompok otot tidak cocok dengan tipe latihan');
    }
    await assertUniqueName(trimmed, id);
    await db.exercises.put({ ...exercise, name: trimmed, muscle_group: group, updated_at: nowIso(), pending: 1 });
  });
  requestSync();
}

// Hapus lunak latihan buatan sendiri. Set di riwayat tetap ada. Kembalikan fungsi "Urungkan".
export async function deleteCustomExercise(id: string): Promise<() => Promise<void>> {
  await setExerciseDeleted(id, true);
  return () => setExerciseDeleted(id, false);
}

async function setExerciseDeleted(id: string, deleted: boolean): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    const exercise = await db.exercises.get(id);
    if (!exercise || !exercise.is_custom) throw new Error('Latihan bawaan tidak bisa dihapus');
    // Saat urungkan, nama bisa saja sudah dipakai latihan lain
    if (!deleted) await assertUniqueName(exercise.name, id);
    const now = nowIso();
    await db.exercises.put({ ...exercise, deleted_at: deleted ? now : null, updated_at: now, pending: 1 });
  });
  requestSync();
}
