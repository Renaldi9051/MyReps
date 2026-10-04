// Bentuk data sama dengan JSON dari BE (snake_case, sesuai "Model data" di docs/PRD.md).
// Waktu disimpan sebagai string ISO UTC, jadi bisa dibandingkan langsung sebagai string.

export type ExerciseType = 'beban' | 'kardio';

export type MuscleGroup = 'dada' | 'punggung' | 'kaki' | 'bahu' | 'lengan' | 'perut' | 'kardio';

type SyncFields = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Exercise = SyncFields & {
  user_id: string | null;
  name: string;
  type: ExerciseType;
  muscle_group: MuscleGroup;
  is_custom: boolean;
};

export type WorkoutSession = SyncFields & {
  user_id?: string;
  date: string; // YYYY-MM-DD, tanggal lokal
  started_at: string;
  ended_at: string | null;
};

export type WorkoutSet = SyncFields & {
  user_id?: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  // true = weight_kg dipegang di tiap tangan (dumbbell), total beban = 2 × weight_kg
  per_hand: boolean;
  duration_sec: number | null;
  incline_pct: number | null;
  speed_kmh: number | null;
};

// Kolom khusus lokal: 1 = ada perubahan yang belum terkirim ke server
export type Local<T> = T & { pending: 0 | 1 };

export type LocalExercise = Local<Exercise>;
export type LocalSession = Local<WorkoutSession>;
export type LocalSet = Local<WorkoutSet>;
