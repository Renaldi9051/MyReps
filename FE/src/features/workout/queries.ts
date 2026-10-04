import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { LocalExercise, LocalSession, LocalSet, MuscleGroup } from '../../db/types';
import { addDays, localDate, startOfWeek } from '../../lib/time';

// Hook baca data. Semua dari Dexie (useLiveQuery), jadi otomatis ter-update
// saat ada perubahan lokal atau hasil pull dari server (F5.4).

const live = <T extends { deleted_at: string | null }>(row: T) => row.deleted_at === null;
const byCreated = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at.localeCompare(b.created_at);
// Beban yang benar-benar diangkat: beban per tangan dihitung dua kali
const totalWeight = (s: LocalSet) => (s.weight_kg ?? 0) * (s.per_hand ? 2 : 1);

export type Usage = { count: number; lastAt: string };

export function useExercises(): LocalExercise[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.exercises.filter(live).toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
  });
}

export function useExerciseSetCount(id: string): number | undefined {
  return useLiveQuery(
    () =>
      db.sets
        .where('[exercise_id+created_at]')
        .between([id, Dexie.minKey], [id, Dexie.maxKey])
        .filter(live)
        .count(),
    [id],
  );
}

// Kelola latihan: latihan buatan sendiri + jumlah set yang memakainya
export function useCustomExercises(): { exercise: LocalExercise; setCount: number }[] | undefined {
  return useLiveQuery(async () => {
    const custom = (await db.exercises.filter((e) => live(e) && e.is_custom).toArray()).sort((a, b) =>
      a.name.localeCompare(b.name, 'id-ID'),
    );
    const counts = new Map<string, number>();
    await db.sets.filter(live).each((s) => counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? 0) + 1));
    return custom.map((exercise) => ({ exercise, setCount: counts.get(exercise.id) ?? 0 }));
  });
}

export function useExercise(id: string | undefined): LocalExercise | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.exercises.get(id)) ?? null) : null), [id]);
}

// F1.2: berapa kali dan kapan terakhir tiap latihan dipakai
export function useExerciseUsage(): Map<string, Usage> | undefined {
  return useLiveQuery(async () => {
    const usage = new Map<string, Usage>();
    await db.sets.filter(live).each((s) => {
      const u = usage.get(s.exercise_id);
      if (!u) usage.set(s.exercise_id, { count: 1, lastAt: s.created_at });
      else {
        u.count += 1;
        if (s.created_at > u.lastAt) u.lastAt = s.created_at;
      }
    });
    return usage;
  });
}

export type TodaySession = { session: LocalSession; sets: LocalSet[] };

export function useTodaySession(): TodaySession | null | undefined {
  return useLiveQuery(async () => {
    const session = (await db.sessions.where('date').equals(localDate()).filter(live).sortBy('created_at'))[0];
    if (!session) return null;
    const sets = await db.sets.where('session_id').equals(session.id).filter(live).toArray();
    return { session, sets: sets.sort(byCreated) };
  });
}

// Set hari ini untuk satu latihan (chip di layar pencatatan)
export function useTodaySets(exerciseId: string): LocalSet[] | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.sessions.where('date').equals(localDate()).filter(live).toArray();
    const ids = new Set(sessions.map((s) => s.id));
    const sets = await db.sets
      .where('[exercise_id+created_at]')
      .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
      .filter((s) => live(s) && ids.has(s.session_id))
      .toArray();
    return sets.sort(byCreated);
  }, [exerciseId]);
}

// F2.4/F2.5/F6.3/F6.4: set terakhir untuk latihan ini, dipakai sebagai acuan dan nilai awal
export function useLastSet(exerciseId: string): LocalSet | null | undefined {
  return useLiveQuery(async () => {
    const last = await db.sets
      .where('[exercise_id+created_at]')
      .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
      .reverse()
      .filter(live)
      .first();
    return last ?? null;
  }, [exerciseId]);
}

// --- Riwayat ---

export type DayGroup = { sessionId: string; exercise: LocalExercise; sets: LocalSet[] };

// Riwayat per tanggal (DESIGN §6.4): semua set di hari itu, dikelompokkan per latihan
// sesuai urutan dikerjakan
export function useDay(date: string): { groups: DayGroup[]; setCount: number } | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.sessions.where('date').equals(date).filter(live).toArray();
    const ids = sessions.map((s) => s.id);
    const sets = (await db.sets.where('session_id').anyOf(ids).filter(live).toArray()).sort(byCreated);
    const exercises = await db.exercises.bulkGet([...new Set(sets.map((s) => s.exercise_id))]);
    const exById = new Map(exercises.filter((e) => e !== undefined).map((e) => [e.id, e]));
    const groups: DayGroup[] = [];
    for (const s of sets) {
      const exercise = exById.get(s.exercise_id);
      if (!exercise) continue;
      const group = groups.find((g) => g.sessionId === s.session_id && g.exercise.id === exercise.id);
      if (group) group.sets.push(s);
      else groups.push({ sessionId: s.session_id, exercise, sets: [s] });
    }
    return { groups, setCount: sets.length };
  }, [date]);
}

export type DayRecord = { exercise: LocalExercise; weightKg: number; previousKg: number };

export type DaySummary = {
  reps: number;
  volumeKg: number; // jumlah rep × beban dari semua set beban (per tangan dihitung dua kali)
  cardioSec: number;
  durationSec: number; // dari set pertama sampai set terakhir di hari itu
  records: DayRecord[];
};

// Ringkasan satu hari di Riwayat. Rekor = beban tertinggi hari itu melebihi beban tertinggi
// di hari-hari sebelumnya (latihan yang baru pertama kali dicatat tidak dihitung rekor).
export function useDaySummary(groups: DayGroup[] | undefined, date: string): DaySummary | undefined {
  return useLiveQuery(async () => {
    if (!groups) return undefined;
    const sets = groups.flatMap((g) => g.sets);
    const summary: DaySummary = { reps: 0, volumeKg: 0, cardioSec: 0, durationSec: 0, records: [] };
    for (const s of sets) {
      if (s.duration_sec !== null) summary.cardioSec += s.duration_sec;
      else {
        summary.reps += s.reps ?? 0;
        summary.volumeKg += (s.reps ?? 0) * totalWeight(s);
      }
    }
    const times = sets.map((s) => Date.parse(s.created_at));
    if (times.length > 1) summary.durationSec = (Math.max(...times) - Math.min(...times)) / 1000;

    const strength = new Map<string, { exercise: LocalExercise; weightKg: number }>();
    for (const g of groups) {
      if (g.exercise.type !== 'beban') continue;
      const max = Math.max(...g.sets.map(totalWeight));
      const prev = strength.get(g.exercise.id);
      if (!prev || max > prev.weightKg) strength.set(g.exercise.id, { exercise: g.exercise, weightKg: max });
    }
    for (const { exercise, weightKg } of strength.values()) {
      if (weightKg <= 0) continue;
      const history = await db.sets
        .where('[exercise_id+created_at]')
        .between([exercise.id, Dexie.minKey], [exercise.id, Dexie.maxKey])
        .filter(live)
        .toArray();
      const sessions = await db.sessions.bulkGet([...new Set(history.map((s) => s.session_id))]);
      const earlier = new Set(
        sessions.filter((s) => s !== undefined && live(s) && s.date < date).map((s) => s!.id),
      );
      const before = history.filter((s) => earlier.has(s.session_id));
      if (before.length === 0) continue;
      const previousKg = Math.max(...before.map(totalWeight));
      if (weightKg > previousKg) summary.records.push({ exercise, weightKg, previousKg });
    }
    return summary;
  }, [groups, date]);
}

// Tanggal yang punya set (titik kecil di kotak tanggal)
export function useActiveDates(): Set<string> | undefined {
  return useLiveQuery(async () => {
    const sets = await db.sets.filter(live).toArray();
    const sessionIds = new Set(sets.map((s) => s.session_id));
    const sessions = await db.sessions.bulkGet([...sessionIds]);
    return new Set(sessions.filter((s) => s !== undefined && live(s)).map((s) => s!.date));
  });
}

// Jumlah sesi minggu ini (Senin–Minggu) yang melatih tiap kelompok otot (DESIGN §5.9, §5.14)
export function useWeekGroupSessions(): Map<MuscleGroup, number> | undefined {
  return useLiveQuery(async () => {
    const from = startOfWeek(localDate());
    const to = addDays(from, 6);
    const sessions = await db.sessions.where('date').between(from, to, true, true).filter(live).toArray();
    const sets = await db.sets.where('session_id').anyOf(sessions.map((s) => s.id)).filter(live).toArray();
    const exercises = await db.exercises.bulkGet([...new Set(sets.map((s) => s.exercise_id))]);
    const groupOf = new Map(exercises.filter((e) => e !== undefined).map((e) => [e.id, e.muscle_group]));
    const perGroup = new Map<MuscleGroup, Set<string>>();
    for (const s of sets) {
      const g = groupOf.get(s.exercise_id);
      if (!g) continue;
      perGroup.set(g, (perGroup.get(g) ?? new Set()).add(s.session_id));
    }
    return new Map([...perGroup.entries()].map(([g, ids]) => [g, ids.size]));
  });
}

export type ActivityGroup = { exercise: LocalExercise; sets: LocalSet[] };

// Heatmap aktivitas di Progres: latihan per tanggal dalam satu tahun, urut dikerjakan.
// Hasil ditandai year supaya hasil tahun lama tidak dipakai saat pindah tahun.
export function useYearActivity(
  year: number,
): { year: number; days: Map<string, ActivityGroup[]> } | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.sessions
      .where('date')
      .between(`${year}-01-01`, `${year}-12-31`, true, true)
      .filter(live)
      .toArray();
    const dateOf = new Map(sessions.map((s) => [s.id, s.date]));
    const sets = (await db.sets.where('session_id').anyOf([...dateOf.keys()]).filter(live).toArray()).sort(byCreated);
    const exercises = await db.exercises.bulkGet([...new Set(sets.map((s) => s.exercise_id))]);
    const exById = new Map(exercises.filter((e) => e !== undefined).map((e) => [e.id, e]));
    const days = new Map<string, ActivityGroup[]>();
    for (const s of sets) {
      const date = dateOf.get(s.session_id);
      const exercise = exById.get(s.exercise_id);
      if (!date || !exercise) continue;
      const groups = days.get(date) ?? [];
      const group = groups.find((g) => g.exercise.id === exercise.id);
      if (group) group.sets.push(s);
      else groups.push({ exercise, sets: [s] });
      days.set(date, groups);
    }
    return { year, days };
  }, [year]);
}

// Tahun paling awal yang punya sesi (batas mundur heatmap)
export function useFirstActivityYear(): number | null | undefined {
  return useLiveQuery(async () => {
    const first = await db.sessions.orderBy('date').filter(live).first();
    return first ? Number(first.date.slice(0, 4)) : null;
  });
}

export type WeekPoint = { label: string; value: number | null };

// Grafik Progres (DESIGN §5.13): 6 minggu terakhir (M1..M6, M6 = minggu ini).
// Beban: beban tertinggi per minggu (kg, per tangan dihitung dua kali). Kardio: total menit per minggu.
// Hasil ditandai exerciseId: saat ganti latihan, hasil lama tidak dipakai untuk latihan baru.
export function useWeeklyTrend(
  exercise: LocalExercise | null | undefined,
): { exerciseId: string; points: WeekPoint[] } | undefined {
  const id = exercise?.id;
  const cardio = exercise?.type === 'kardio';
  return useLiveQuery(async () => {
    if (!id) return undefined;
    const thisWeek = startOfWeek(localDate());
    const starts = Array.from({ length: 6 }, (_, i) => addDays(thisWeek, (i - 5) * 7));
    const sets = await db.sets
      .where('[exercise_id+created_at]')
      .between([id, Dexie.minKey], [id, Dexie.maxKey])
      .filter(live)
      .toArray();
    const sessions = await db.sessions.bulkGet([...new Set(sets.map((s) => s.session_id))]);
    const dateOf = new Map(sessions.filter((s) => s !== undefined).map((s) => [s!.id, s!.date]));
    const values = starts.map(() => null as number | null);
    for (const s of sets) {
      const date = dateOf.get(s.session_id);
      if (!date) continue;
      const week = starts.findIndex((start, i) => date >= start && (i === 5 || date < starts[i + 1]!));
      if (week < 0) continue;
      const v = cardio ? (s.duration_sec ?? 0) / 60 : totalWeight(s);
      const prev = values[week];
      values[week] = cardio ? (prev ?? 0) + v : Math.max(prev ?? 0, v);
    }
    const points = values.map((value, i) => ({
      label: `M${i + 1}`,
      value: value === null ? null : Math.round(value * 10) / 10,
    }));
    return { exerciseId: id, points };
  }, [id, cardio]);
}

export type DateGroup = { date: string; sets: LocalSet[] };

// F4.3: semua set untuk satu latihan, dikelompokkan per tanggal (terbaru di atas)
export function useExerciseHistory(exerciseId: string | undefined): DateGroup[] | undefined {
  return useLiveQuery(async () => {
    if (!exerciseId) return [];
    const sets = await db.sets
      .where('[exercise_id+created_at]')
      .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
      .filter(live)
      .toArray();
    const sessions = await db.sessions.bulkGet([...new Set(sets.map((s) => s.session_id))]);
    const dateOf = new Map(sessions.filter((s) => s !== undefined).map((s) => [s.id, s.date]));
    const byDate = new Map<string, LocalSet[]>();
    for (const s of sets.sort(byCreated)) {
      const date = dateOf.get(s.session_id);
      if (!date) continue;
      byDate.set(date, [...(byDate.get(date) ?? []), s]);
    }
    return [...byDate.entries()]
      .map(([date, rows]) => ({ date, sets: rows }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [exerciseId]);
}
