import { Check } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import type { LocalSet } from '../db/types';
import { formatSet } from '../lib/format';

type Props = {
  sets: LocalSet[];
  // Isi baris "sedang berjalan" (nilai yang sedang dihitung), mis. "8 × 40 kg"
  running: string;
};

// DESIGN §5.7: set tersimpan (hanya dibaca; edit lewat Riwayat) + satu baris putus-putus yang sedang berjalan
export function SetRows({ sets, running }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Set baru tersimpan: gulir supaya baris yang sedang berjalan tetap terlihat
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sets.length]);

  return (
    <div className="set-rows" ref={ref}>
      {sets.map((s, i) => (
        <div key={s.id} className="set-row">
          <span>
            <b>Set {i + 1}</b> · {formatSet(s)}
          </span>
          <Check size={20} strokeWidth={1.75} />
        </div>
      ))}
      <div className="set-row set-row--running" aria-label={`Set ${sets.length + 1} sedang berjalan`}>
        {/* key = isi: teks berganti dengan kedip kecil tiap rep/beban berubah */}
        <span key={running} className="set-row__live">
          <b>Set {sets.length + 1}</b> · {running}
        </span>
      </div>
    </div>
  );
}
