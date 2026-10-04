import { and, asc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { PushBody } from '../lib/sync-schema.js';
import { db, type Tx } from './index.js';
import { exercise, workoutSession, workoutSet } from './schema.js';

// Aturan sinkron (PRD F7.2–F7.4):
// - Push: upsert per baris; baris server hanya ditimpa kalau updated_at dari klien
//   lebih baru (last write wins) dan baris itu milik user yang sama.
// - Pull: cursor = sync_seq, nomor urut yang diisi server setiap kali baris ditulis.
//   Karena bukan jam perangkat, data yang di-push terlambat tetap ikut ter-pull.
// - Hapus = deleted_at terisi (hapus lunak), jadi ikut tersinkron seperti perubahan biasa.

const excluded = (column: PgColumn): SQL => sql.raw(`excluded."${column.name}"`);
const nextSeq = sql`nextval('sync_seq')`;

type Rejected = { id: string; reason: string };

export type PushResult = {
  // Tidak ditimpa karena versi server lebih baru, atau id milik akun lain / latihan bawaan
  skipped: string[];
  // Ditolak karena merujuk sesi atau latihan yang tidak ada / bukan milik akun ini
  rejected: Rejected[];
};

// Kalau satu id muncul dua kali di batch, ambil versi paling baru.
// (ON CONFLICT tidak boleh menyentuh baris yang sama dua kali dalam satu perintah.)
function latestById<T extends { id: string; updated_at: Date }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const prev = byId.get(row.id);
    if (!prev || prev.updated_at < row.updated_at) byId.set(row.id, row);
  }
  return [...byId.values()];
}

function notWritten(input: { id: string }[], written: { id: string }[]): string[] {
  const ok = new Set(written.map((r) => r.id));
  return input.filter((r) => !ok.has(r.id)).map((r) => r.id);
}

async function pushExercises(tx: Tx, userId: string, rows: PushBody['exercises']) {
  if (rows.length === 0) return [];
  const written = await tx
    .insert(exercise)
    .values(rows.map((r) => ({ ...r, user_id: userId, is_custom: true })))
    .onConflictDoUpdate({
      target: exercise.id,
      set: {
        name: excluded(exercise.name),
        type: excluded(exercise.type),
        muscle_group: excluded(exercise.muscle_group),
        updated_at: excluded(exercise.updated_at),
        deleted_at: excluded(exercise.deleted_at),
        sync_seq: nextSeq,
      },
      setWhere: and(
        eq(exercise.user_id, userId),
        lt(exercise.updated_at, excluded(exercise.updated_at)),
      ),
    })
    .returning({ id: exercise.id });
  return notWritten(rows, written);
}

async function pushSessions(tx: Tx, userId: string, rows: PushBody['sessions']) {
  if (rows.length === 0) return [];
  const written = await tx
    .insert(workoutSession)
    .values(rows.map((r) => ({ ...r, user_id: userId })))
    .onConflictDoUpdate({
      target: workoutSession.id,
      set: {
        date: excluded(workoutSession.date),
        started_at: excluded(workoutSession.started_at),
        ended_at: excluded(workoutSession.ended_at),
        updated_at: excluded(workoutSession.updated_at),
        deleted_at: excluded(workoutSession.deleted_at),
        sync_seq: nextSeq,
      },
      setWhere: and(
        eq(workoutSession.user_id, userId),
        lt(workoutSession.updated_at, excluded(workoutSession.updated_at)),
      ),
    })
    .returning({ id: workoutSession.id });
  return notWritten(rows, written);
}

async function pushSets(tx: Tx, userId: string, rows: PushBody['sets']) {
  if (rows.length === 0) return { skipped: [], rejected: [] };

  // Set hanya boleh merujuk sesi milik sendiri dan latihan bawaan / custom milik sendiri
  const sessionIds = [...new Set(rows.map((r) => r.session_id))];
  const exerciseIds = [...new Set(rows.map((r) => r.exercise_id))];
  const ownedSessions = await tx
    .select({ id: workoutSession.id })
    .from(workoutSession)
    .where(and(eq(workoutSession.user_id, userId), inArray(workoutSession.id, sessionIds)));
  const usableExercises = await tx
    .select({ id: exercise.id })
    .from(exercise)
    .where(
      and(
        inArray(exercise.id, exerciseIds),
        or(eq(exercise.user_id, userId), isNull(exercise.user_id)),
      ),
    );
  const sessionOk = new Set(ownedSessions.map((r) => r.id));
  const exerciseOk = new Set(usableExercises.map((r) => r.id));

  const rejected: Rejected[] = [];
  const valid = rows.filter((r) => {
    if (!sessionOk.has(r.session_id)) {
      rejected.push({ id: r.id, reason: 'Sesi tidak ditemukan' });
      return false;
    }
    if (!exerciseOk.has(r.exercise_id)) {
      rejected.push({ id: r.id, reason: 'Latihan tidak ditemukan' });
      return false;
    }
    return true;
  });
  if (valid.length === 0) return { skipped: [], rejected };

  const written = await tx
    .insert(workoutSet)
    .values(valid.map((r) => ({ ...r, user_id: userId })))
    .onConflictDoUpdate({
      target: workoutSet.id,
      set: {
        session_id: excluded(workoutSet.session_id),
        exercise_id: excluded(workoutSet.exercise_id),
        set_number: excluded(workoutSet.set_number),
        reps: excluded(workoutSet.reps),
        weight_kg: excluded(workoutSet.weight_kg),
        per_hand: excluded(workoutSet.per_hand),
        duration_sec: excluded(workoutSet.duration_sec),
        incline_pct: excluded(workoutSet.incline_pct),
        speed_kmh: excluded(workoutSet.speed_kmh),
        updated_at: excluded(workoutSet.updated_at),
        deleted_at: excluded(workoutSet.deleted_at),
        sync_seq: nextSeq,
      },
      setWhere: and(
        eq(workoutSet.user_id, userId),
        lt(workoutSet.updated_at, excluded(workoutSet.updated_at)),
      ),
    })
    .returning({ id: workoutSet.id });
  return { skipped: notWritten(valid, written), rejected };
}

export async function pushChanges(userId: string, body: PushBody): Promise<PushResult> {
  return db.transaction(async (tx) => {
    // Push dari beberapa perangkat milik user yang sama diproses bergantian,
    // supaya urutan sync_seq sama dengan urutan commit (cursor pull tidak melompat).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    // Urutan penting: set merujuk sesi dan latihan yang mungkin ada di batch yang sama
    const skippedExercises = await pushExercises(tx, userId, latestById(body.exercises));
    const skippedSessions = await pushSessions(tx, userId, latestById(body.sessions));
    const sets = await pushSets(tx, userId, latestById(body.sets));

    return {
      skipped: [...skippedExercises, ...skippedSessions, ...sets.skipped],
      rejected: sets.rejected,
    };
  });
}

export async function pullChanges(userId: string, since: number, limit: number) {
  // Snapshot yang sama untuk ketiga tabel
  return db.transaction(
    async (tx) => {
      const exercises = await tx
        .select()
        .from(exercise)
        .where(
          and(
            gt(exercise.sync_seq, since),
            or(eq(exercise.user_id, userId), isNull(exercise.user_id)),
          ),
        )
        .orderBy(asc(exercise.sync_seq))
        .limit(limit);
      const sessions = await tx
        .select()
        .from(workoutSession)
        .where(and(gt(workoutSession.sync_seq, since), eq(workoutSession.user_id, userId)))
        .orderBy(asc(workoutSession.sync_seq))
        .limit(limit);
      const sets = await tx
        .select()
        .from(workoutSet)
        .where(and(gt(workoutSet.sync_seq, since), eq(workoutSet.user_id, userId)))
        .orderBy(asc(workoutSet.sync_seq))
        .limit(limit);

      // Ambil `limit` baris dengan sync_seq terkecil dari gabungan ketiga tabel,
      // supaya cursor tidak melewati baris yang belum terkirim.
      const seqs = [...exercises, ...sessions, ...sets]
        .map((r) => r.sync_seq)
        .sort((a, b) => a - b);
      const hasMore = seqs.length > limit;
      const cursor = hasMore ? seqs[limit - 1]! : (seqs.at(-1) ?? since);
      const upTo = <T extends { sync_seq: number }>(rows: T[]) =>
        rows.filter((r) => r.sync_seq <= cursor).map(({ sync_seq: _, ...rest }) => rest);

      return {
        exercises: upTo(exercises),
        sessions: upTo(sessions),
        sets: upTo(sets),
        cursor,
        has_more: hasMore,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
