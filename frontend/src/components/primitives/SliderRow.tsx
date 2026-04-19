'use client';

/**
 * SliderRow — canonical labeled range input used across panels.
 *
 * Visual: [label (fixed width)] [gradient-filled range] [value (mono)]
 *
 * Sizing matches LoopPanel/VFXPanel originals (72px label / flex track /
 * 30–36px value). The gradient fill on the track communicates progress
 * without relying on the browser default, and is applied via inline style
 * rather than CSS vars so SSR stays deterministic.
 *
 * The actual thumb/track base style comes from globals.css input[type=range].
 * We only paint the filled portion.
 */

interface SliderRowProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  /** Trailing unit suffix on the value display, e.g. '×', 's', '%'. */
  unit?: string;
  /** Greyed out + non-interactive. Cleaner than wrapping in pointer-events-none. */
  disabled?: boolean;
  /** Override the fixed-width label column. Defaults to 72px. */
  labelWidth?: number;
  /** Decimal places for the value display. Defaults to 2 when step<0.1 else 1. */
  precision?: number;
}

export function SliderRow({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  unit = '',
  disabled = false,
  labelWidth = 72,
  precision,
}: SliderRowProps) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  const digits = precision ?? (step < 0.1 ? 2 : 1);

  return (
    <div
      className={`flex items-center gap-2 transition-opacity ${
        disabled ? 'opacity-30 pointer-events-none' : ''
      }`}
    >
      <span className="text-[10px] text-ink-400 shrink-0" style={{ width: labelWidth }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="flex-1 h-1 cursor-pointer"
        style={{
          background: `linear-gradient(to right, #1a1a16 0%, #1a1a16 ${pct}%, #d4cfc6 ${pct}%, #d4cfc6 100%)`,
        }}
      />
      <span className="font-mono text-[10px] text-ink-500 w-[34px] text-right tabular-nums">
        {value.toFixed(digits)}
        {unit}
      </span>
    </div>
  );
}

export default SliderRow;
