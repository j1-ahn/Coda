'use client';

/**
 * ModeBtn — pill button for exclusive mode selectors (WIND/RIPPLE/DEPTH,
 * SIMPLE/BOX/LIST, etc). Active state uses the ink-900 primary treatment;
 * inactive state is a muted cream border that lifts on hover.
 *
 * Layout: `flex-1 py-1` so a row of ModeBtns divides width evenly when
 * wrapped in a `flex gap-*` container. Tweak with className override.
 */

interface ModeBtnProps {
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function ModeBtn({ label, active, onClick, className = '', disabled = false }: ModeBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-1 rounded-none border text-[10px] font-semibold tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-ink-900 text-cream-100 border-ink-900'
          : 'border-cream-300 text-ink-500 hover:text-ink-900 hover:border-ink-500'
      } ${className}`}
    >
      {label}
    </button>
  );
}

export default ModeBtn;
