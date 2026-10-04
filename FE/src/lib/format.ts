import type { WorkoutSet } from '../db/types';
import { localDate, parseLocalDate } from './time';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const fixed1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dayMonth = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
const longDate = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const monthYear = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

// 42.5 -> "42,5"
export const formatNumber = (n: number): string => number.format(n);

// Speed selalu 1 desimal: 5 -> "5,0"
export const formatSpeed = (n: number): string => fixed1.format(n);

// Stopwatch: 905 -> "15:05", 3725 -> "1:02:05"
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// Durasi kardio di daftar: menit bulat jadi "20 mnt", selain itu "20:15"
export function formatMinutes(totalSec: number): string {
  return totalSec % 60 === 0 ? `${totalSec / 60} mnt` : formatDuration(totalSec);
}

// "Selasa, 29 September"
export const formatDayMonth = (date: string): string => dayMonth.format(parseLocalDate(date));

// "Rabu, 30 September 2026"
export const formatLongDate = (date: string): string => longDate.format(parseLocalDate(date));

// "September 2026" (month mulai 0 seperti Date)
export const formatMonthYear = (year: number, month: number): string => monthYear.format(new Date(year, month, 1));

export function formatDateLabel(date: string): string {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date === localDate(today)) return 'Hari ini';
  if (date === localDate(yesterday)) return 'Kemarin';
  return longDate.format(parseLocalDate(date));
}

type SetValues = Pick<WorkoutSet, 'reps' | 'weight_kg' | 'per_hand' | 'duration_sec' | 'incline_pct' | 'speed_kmh'>;

// Pisah beban (kiri + kanan) ditulis dua kali: "5 + 5 kg"
export const formatWeight = (kg: number, perHand: boolean): string =>
  perHand ? `${formatNumber(kg)} + ${formatNumber(kg)} kg` : `${formatNumber(kg)} kg`;

// DESIGN.md §3: "10 × 40 kg", "10 × 5 + 5 kg", atau "20 mnt · 6% · 6,5 km/j"
export function formatSet(set: SetValues): string {
  if (set.duration_sec !== null) {
    const parts = [formatMinutes(set.duration_sec)];
    if (set.incline_pct !== null) parts.push(`${formatNumber(set.incline_pct)}%`);
    if (set.speed_kmh !== null) parts.push(`${formatSpeed(set.speed_kmh)} km/j`);
    return parts.join(' · ');
  }
  return `${set.reps ?? 0} × ${formatWeight(set.weight_kg ?? 0, set.per_hand)}`;
}

// Chip set: "10 × 40", "10 × 5+5", atau "20 mnt"
export function formatSetCompact(set: SetValues): string {
  if (set.duration_sec !== null) return formatMinutes(set.duration_sec);
  const kg = formatNumber(set.weight_kg ?? 0);
  return `${set.reps ?? 0} × ${set.per_hand ? `${kg}+${kg}` : kg}`;
}

// Ringkasan baris latihan di riwayat: "3 set" atau "20 mnt · 6%"
export function formatGroupSummary(sets: SetValues[]): string {
  const cardio = sets.filter((s) => s.duration_sec !== null);
  if (cardio.length === 0) return `${sets.length} set`;
  const total = cardio.reduce((sum, s) => sum + (s.duration_sec ?? 0), 0);
  const incline = cardio.at(-1)?.incline_pct ?? null;
  return incline === null ? formatMinutes(total) : `${formatMinutes(total)} · ${formatNumber(incline)}%`;
}
