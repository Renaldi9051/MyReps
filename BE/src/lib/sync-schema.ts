import { z } from 'zod';
import { exerciseType, muscleGroup } from '../db/schema.js';

// Batas per request supaya push tidak terlalu besar; klien mengirim bertahap.
export const MAX_PUSH_ROWS = 500;
export const MAX_PULL_ROWS = 1000;

const timestamp = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

// Kolom yang dikirim klien untuk semua tabel sinkron.
// user_id, is_custom, dan sync_seq sengaja tidak diterima: server yang mengisi.
const syncFields = {
  id: z.uuid(),
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
};

export const exerciseInput = z.object({
  ...syncFields,
  name: z.string().trim().min(1).max(60),
  type: z.enum(exerciseType.enumValues),
  muscle_group: z.enum(muscleGroup.enumValues),
});

export const sessionInput = z.object({
  ...syncFields,
  date: z.iso.date(),
  started_at: timestamp,
  ended_at: timestamp.nullable(),
});

export const setInput = z
  .object({
    ...syncFields,
    session_id: z.uuid(),
    exercise_id: z.uuid(),
    set_number: z.number().int().min(1),
    reps: z.number().int().min(0).nullable(),
    weight_kg: z.number().min(0).max(9999).multipleOf(2.5).nullable(),
    // Klien lama belum mengirim field ini
    per_hand: z.boolean().default(false),
    duration_sec: z.number().int().min(0).nullable(),
    incline_pct: z.number().min(0).max(999).multipleOf(0.5).nullable(),
    speed_kmh: z.number().min(0).max(999).multipleOf(0.1).nullable(),
  })
  .refine((s) => (s.reps !== null && s.weight_kg !== null) || s.duration_sec !== null, {
    message: 'Set beban wajib punya reps dan weight_kg; kardio wajib punya duration_sec',
  });

export const pushBody = z.object({
  exercises: z.array(exerciseInput).max(MAX_PUSH_ROWS).default([]),
  sessions: z.array(sessionInput).max(MAX_PUSH_ROWS).default([]),
  sets: z.array(setInput).max(MAX_PUSH_ROWS).default([]),
});

export const pullQuery = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_PULL_ROWS).default(MAX_PULL_ROWS),
});

export type ExerciseInput = z.infer<typeof exerciseInput>;
export type SessionInput = z.infer<typeof sessionInput>;
export type SetInput = z.infer<typeof setInput>;
export type PushBody = z.infer<typeof pushBody>;
