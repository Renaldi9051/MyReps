import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Better Auth (nama field camelCase wajib sama dengan yang dipakai Better Auth)
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Data latihan (nama field snake_case, sama dengan "Model data" di docs/PRD.md)
// ---------------------------------------------------------------------------

export const exerciseType = pgEnum('exercise_type', ['beban', 'kardio']);

export const muscleGroup = pgEnum('muscle_group', [
  'dada',
  'punggung',
  'kaki',
  'bahu',
  'lengan',
  'perut',
  'kardio',
]);

// Nomor urut global untuk cursor sinkron (pull). Naik setiap kali baris ditulis
// server, jadi data yang di-push terlambat dari perangkat offline tetap ikut ter-pull.
export const syncSeq = pgSequence('sync_seq');

const syncColumns = () => ({
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  // Waktu ubah dari perangkat; dipakai untuk aturan konflik (F7.4)
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull(),
  // Hapus lunak supaya penghapusan ikut tersinkron
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  sync_seq: bigint('sync_seq', { mode: 'number' })
    .notNull()
    .default(sql`nextval('sync_seq')`),
});

export const exercise = pgTable(
  'exercise',
  {
    id: uuid('id').primaryKey(),
    // null = latihan bawaan, terisi = latihan custom milik akun
    user_id: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: exerciseType('type').notNull(),
    muscle_group: muscleGroup('muscle_group').notNull(),
    is_custom: boolean('is_custom').notNull().default(false),
    ...syncColumns(),
  },
  (t) => [
    index('exercise_user_seq_idx').on(t.user_id, t.sync_seq),
    check('exercise_custom_owner', sql`${t.is_custom} = (${t.user_id} is not null)`),
  ],
);

export const workoutSession = pgTable(
  'workout_session',
  {
    id: uuid('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    started_at: timestamp('started_at', { withTimezone: true }).notNull(),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    ...syncColumns(),
  },
  (t) => [
    index('workout_session_user_seq_idx').on(t.user_id, t.sync_seq),
    index('workout_session_user_date_idx').on(t.user_id, t.date),
  ],
);

export const workoutSet = pgTable(
  'workout_set',
  {
    id: uuid('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    session_id: uuid('session_id')
      .notNull()
      .references(() => workoutSession.id, { onDelete: 'cascade' }),
    exercise_id: uuid('exercise_id')
      .notNull()
      .references(() => exercise.id),
    set_number: integer('set_number').notNull(),
    // Latihan beban
    reps: integer('reps'),
    weight_kg: numeric('weight_kg', { precision: 6, scale: 2, mode: 'number' }),
    // true = weight_kg dipegang di tiap tangan (mis. dumbbell 5 kg kiri + 5 kg kanan)
    per_hand: boolean('per_hand').notNull().default(false),
    // Kardio
    duration_sec: integer('duration_sec'),
    incline_pct: numeric('incline_pct', { precision: 4, scale: 1, mode: 'number' }),
    speed_kmh: numeric('speed_kmh', { precision: 4, scale: 1, mode: 'number' }),
    ...syncColumns(),
  },
  (t) => [
    index('workout_set_user_seq_idx').on(t.user_id, t.sync_seq),
    index('workout_set_session_idx').on(t.session_id),
    index('workout_set_exercise_idx').on(t.exercise_id),
    check('workout_set_number_positive', sql`${t.set_number} >= 1`),
    check('workout_set_reps_nonneg', sql`${t.reps} >= 0`),
    check('workout_set_weight_nonneg', sql`${t.weight_kg} >= 0`),
    check('workout_set_duration_nonneg', sql`${t.duration_sec} >= 0`),
    check('workout_set_incline_nonneg', sql`${t.incline_pct} >= 0`),
    check('workout_set_speed_nonneg', sql`${t.speed_kmh} >= 0`),
  ],
);

export type Exercise = typeof exercise.$inferSelect;
export type WorkoutSession = typeof workoutSession.$inferSelect;
export type WorkoutSet = typeof workoutSet.$inferSelect;
