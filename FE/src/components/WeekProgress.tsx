import type { MuscleGroup } from '../db/types';
import { MUSCLE_GROUPS } from '../lib/labels';

export const WEEKLY_TARGET = 4;

type Props = { counts: Map<MuscleGroup, number> };

// DESIGN §5.9: satu segmen = satu sesi minggu ini, target 4 per kelompok otot
export function SegmentBars({ counts }: Props) {
  return (
    <>
      <ul className="seg-list">
        {MUSCLE_GROUPS.map(({ value, label }) => {
          const n = Math.min(counts.get(value) ?? 0, WEEKLY_TARGET);
          return (
            <li key={value} className="seg-row">
              <span>{label}</span>
              <span className="seg-bar" role="img" aria-label={`${label}: ${counts.get(value) ?? 0} dari ${WEEKLY_TARGET} sesi`}>
                {Array.from({ length: WEEKLY_TARGET }, (_, i) => (
                  <span key={i} className={i < n ? 'seg is-filled' : 'seg'} />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="small seg-note">
        Sesi per kelompok otot, target {WEEKLY_TARGET} per minggu
      </p>
    </>
  );
}

const R = 36;
const C = 2 * Math.PI * R;

// DESIGN §5.14: cincin 88×88, busur = sesi / target
export function ProgressRings({ counts }: Props) {
  return (
    <div className="rings">
      {MUSCLE_GROUPS.map(({ value, label }) => {
        const n = counts.get(value) ?? 0;
        const ratio = Math.min(n / WEEKLY_TARGET, 1);
        return (
          <div key={value} className="ring-item">
            <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${label}: ${n} dari ${WEEKLY_TARGET} sesi`}>
              <circle cx="44" cy="44" r={R} fill="none" strokeWidth="8" style={{ stroke: 'var(--line-soft)' }} />
              {ratio > 0 && (
                <circle
                  className="ring-arc"
                  cx="44"
                  cy="44"
                  r={R}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${ratio * C} ${C}`}
                  transform="rotate(-90 44 44)"
                  style={{ stroke: 'var(--ink)' }}
                />
              )}
              <text x="44" y="44" textAnchor="middle" dominantBaseline="central" style={{ fill: 'var(--ink)' }}>
                {n}/{WEEKLY_TARGET}
              </text>
            </svg>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
