'use client';

/**
 * LabelCaps — small-caps label, 10px tracked uppercase.
 *
 * Lightweight wrapper over the `.label-caps` utility class defined in
 * globals.css. Exists so components can use a typed React element
 * (better auto-import, consistent color story) instead of raw
 * <span className="label-caps">.
 */

import type { ReactNode } from 'react';

interface LabelCapsProps {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div' | 'label';
  htmlFor?: string;
}

export function LabelCaps({ children, className = '', as = 'span', htmlFor }: LabelCapsProps) {
  const combined = `label-caps ${className}`.trim();
  if (as === 'div')   return <div   className={combined}>{children}</div>;
  if (as === 'label') return <label className={combined} htmlFor={htmlFor}>{children}</label>;
  return <span className={combined}>{children}</span>;
}

export default LabelCaps;
