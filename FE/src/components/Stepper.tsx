import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useHoldRepeat } from './useHoldRepeat';

type Props = {
  label: string;
  // Nilai lengkap dengan satuan, mis. "40 kg"
  value: string;
  onDec: () => void;
  onInc: () => void;
  canDec?: boolean;
  canInc?: boolean;
};

// DESIGN §5.6: pil ( −  Beban 40 kg  + ). Tahan tombol untuk mengulang cepat.
export function Stepper({ label, value, onDec, onInc, canDec = true, canInc = true }: Props) {
  // Arah perubahan terakhir: nilai baru naik dari bawah saat +, turun dari atas saat −
  const [dir, setDir] = useState<1 | -1 | 0>(0);
  const dec = useHoldRepeat(() => {
    setDir(-1);
    onDec();
  }, !canDec);
  const inc = useHoldRepeat(() => {
    setDir(1);
    onInc();
  }, !canInc);

  return (
    <div className="stepper">
      <button type="button" className="icon-circle" aria-label={`Kurangi ${label.toLowerCase()}`} disabled={!canDec} {...dec}>
        <Minus size={22} strokeWidth={1.75} />
      </button>
      <output className="stepper__text" aria-live="polite">
        <span className="muted">{label} </span>
        {/* key = nilai: span dipasang ulang tiap berubah supaya animasinya diputar lagi */}
        <span key={value} className={dir === 0 ? 'stepper__value' : dir === 1 ? 'stepper__value is-up' : 'stepper__value is-down'}>
          {value}
        </span>
      </output>
      <button type="button" className="icon-circle" aria-label={`Tambah ${label.toLowerCase()}`} disabled={!canInc} {...inc}>
        <Plus size={22} strokeWidth={1.75} />
      </button>
    </div>
  );
}
