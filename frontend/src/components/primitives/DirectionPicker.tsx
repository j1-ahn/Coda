'use client';

/**
 * DirectionPicker — 8-way arrow selector. Value is an index 0..7 mapping to
 * right/down-right/down/.../up-right. Used by wind/ripple/drift controls.
 *
 * Keeps the label column aligned with SliderRow so they can stack in a
 * consistent grid without ad-hoc widths.
 */

const DIR_LABELS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

interface DirectionPickerProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  labelWidth?: number;
}

export function DirectionPicker({
  value,
  onChange,
  label = 'Direction',
  labelWidth = 72,
}: DirectionPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-ink-400 shrink-0" style={{ width: labelWidth }}>
        {label}
      </span>
      <div className="flex gap-0.5">
        {DIR_LABELS.map((lbl, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`w-6 h-6 text-[11px] border transition-colors ${
              value === i
                ? 'bg-ink-900 text-cream-100 border-ink-900'
                : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DirectionPicker;
