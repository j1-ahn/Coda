'use client';

import dynamic from 'next/dynamic';
import { useRef, useEffect, useCallback } from 'react';
import type { AudioAnalyserData } from '@/hooks/useAudioAnalyser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EQPreset {
  id: string;
  name: string;
  reactMode: 'pulse' | 'ripple' | 'chromatic' | 'warp';
  colorTint: string;
  imagePath?: string; // kept for compat — not used in rendering
}

interface EQCanvasProps {
  preset: EQPreset;
  analyserData: AudioAnalyserData;
}

// Per-preset mutable state that persists across frames
interface DrawState {
  particles?: Particle[];
  traceHistory?: Array<{ x: number; y: number }[]>;
  pixelGrid?: number[][];
  blobAngles?: number[];
  prevBass?: number;
  beatCooldown?: number;
  phase?: number;
  // Lissajous: smoothed audio values to avoid abrupt shape changes
  lissA?: number;   // smoothed a value
  lissB?: number;   // smoothed b value
  lissPhase?: number; // continuous phase accumulator
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; hue: number;
}

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  data: AudioAnalyserData,
  time: number,
  state: DrawState,
  preset: EQPreset,
) => void;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ---------------------------------------------------------------------------
// ECLIPSE — black-hole corona (이퀄2 레퍼런스)
// Dark circle, teal glowing corona that pulses with bass, flares on beats
// ---------------------------------------------------------------------------
const drawEclipse: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  const cx = w / 2, cy = h / 2;
  const baseR = Math.min(w, h) * 0.22;
  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const bass = data.bassLevel;

  ctx.fillStyle = '#020508';
  ctx.fillRect(0, 0, w, h);

  // Corona glow layers (outermost first)
  for (let i = 5; i >= 0; i--) {
    const r = baseR * (1.5 + i * 0.45 + bass * 1.4);
    const a = (0.07 - i * 0.01) * (0.4 + bass * 0.9);
    const g = ctx.createRadialGradient(cx, cy, baseR * 0.85, cx, cy, r);
    g.addColorStop(0,   `rgba(${tr},${tg},${tb},${a * 3})`);
    g.addColorStop(0.4, `rgba(${tr},${tg},${tb},${a})`);
    g.addColorStop(1,   `rgba(${tr},${tg},${tb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  // Radial flares driven by frequency bins
  const { frequencyData } = data;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + time * 0.08;
    const bin = Math.floor((i / 12) * frequencyData.length * 0.35);
    const str = (frequencyData[bin] / 255) * (0.4 + bass * 0.6);
    const len = baseR * (0.2 + str * 2.2);
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${str * 0.85})`;
    ctx.lineWidth = 0.8 + str * 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * baseR * 1.04, cy + Math.sin(angle) * baseR * 1.04);
    ctx.lineTo(cx + Math.cos(angle) * (baseR * 1.04 + len), cy + Math.sin(angle) * (baseR * 1.04 + len));
    ctx.stroke();
  }

  // Rim
  ctx.strokeStyle = `rgba(${tr},${tg},${tb},${0.25 + bass * 0.45})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, baseR * (1.02 + data.overallLevel * 0.04), 0, Math.PI * 2); ctx.stroke();

  // Black disc
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI * 2); ctx.fill();

  // Inner edge glow
  const ig = ctx.createRadialGradient(cx, cy, baseR * 0.78, cx, cy, baseR);
  ig.addColorStop(0,   'rgba(0,0,0,1)');
  ig.addColorStop(0.75,'rgba(0,0,0,1)');
  ig.addColorStop(1,   `rgba(${tr},${tg},${tb},${0.12 + bass * 0.28})`);
  ctx.fillStyle = ig;
  ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI * 2); ctx.fill();
};

// ---------------------------------------------------------------------------
// WAVEFORM — Aphex Twin oscilloscope (이퀄3 레퍼런스)
// Black bg, green sine wave, CRT grid, digital readout
// ---------------------------------------------------------------------------
const drawWaveform: DrawFn = (ctx, w, h, data, time) => {
  ctx.fillStyle = 'rgba(4, 7, 4, 0.82)';
  ctx.fillRect(0, 0, w, h);

  // CRT grid
  ctx.strokeStyle = 'rgba(0,150,55,0.10)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 6; i++) {
    const y = (i / 6) * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }

  const { frequencyData, overallLevel, bassLevel } = data;
  const cy = h * 0.5;
  const amp = h * 0.36 * (0.45 + overallLevel * 1.3);

  // Multi-pass glow
  for (let pass = 0; pass < 3; pass++) {
    const alpha = pass === 2 ? 0.95 : 0.25 - pass * 0.08;
    const lw    = pass === 2 ? 1.5 : 4 - pass * 1.5;
    ctx.strokeStyle = `rgba(0,${220 + pass * 10},70,${alpha})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * w;
      const bin = Math.floor((i / 255) * (frequencyData.length - 1));
      const norm = (frequencyData[bin] / 255) * 2 - 1;
      const idle = Math.sin(x * 0.022 + time * 2.1) * 0.08 * (1 - overallLevel);
      const y = cy - (norm + idle) * amp;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const fs = Math.max(10, w * 0.027);
  ctx.font = `${fs}px monospace`;
  ctx.fillStyle = 'rgba(0,200,60,0.65)';
  ctx.textAlign = 'left';  ctx.fillText('PCM 192KHZ', w * 0.04, h * 0.1);
  ctx.textAlign = 'right'; ctx.fillText('BAT [████]', w * 0.96, h * 0.1);

  const mm = String(Math.floor(time / 60)).padStart(2, '0');
  const ss = String(Math.floor(time % 60)).padStart(2, '0');
  const cs = String(Math.floor((time % 1) * 100)).padStart(2, '0');
  ctx.font = `bold ${Math.max(14, w * 0.11)}px monospace`;
  ctx.fillStyle = `rgba(0,230,75,${0.65 + bassLevel * 0.35})`;
  ctx.textAlign = 'center';
  ctx.fillText(`${mm}:${ss}:${cs}`, w / 2, h * 0.57);
};

// ---------------------------------------------------------------------------
// LISSAJOUS — parametric figure (이퀄4 레퍼런스)
// Blue Lissajous curve, persistence traces, dark blue bg.
// a:b는 고정 비율(3:2)을 기반으로 exponential smoothing으로 매우 서서히 변화.
// 위상 delta는 연속적으로 누적되어 도형이 부드럽게 회전/변형됨.
// ---------------------------------------------------------------------------
const drawLissajous: DrawFn = (ctx, w, h, data, _time, state) => {
  if (!state.traceHistory)  state.traceHistory  = [];
  if (state.lissA      === undefined) state.lissA      = 3.0;
  if (state.lissB      === undefined) state.lissB      = 2.0;
  if (state.lissPhase  === undefined) state.lissPhase  = 0.0;

  ctx.fillStyle = '#000814';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  // Radius pulses gently with overall level, never jumps
  const r = Math.min(w, h) * (0.34 + data.overallLevel * 0.06);

  // Outer frame rings
  ctx.strokeStyle = 'rgba(29,111,255,0.13)';
  ctx.lineWidth = 1;
  [1.06, 1.12].forEach(s => {
    ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, Math.PI * 2); ctx.stroke();
  });

  // ── Smooth a & b with heavy low-pass (τ ≈ 120 frames ≈ 2 s at 60 fps) ──
  // Target: 3:2 base ratio, bass nudges a, mid nudges b — max ±0.4 offset
  const targetA = 3.0 + data.bassLevel * 0.4;
  const targetB = 2.0 + data.midLevel  * 0.3;
  const α = 0.012; // smoothing factor — lower = slower change
  state.lissA! += (targetA - state.lissA!) * α;
  state.lissB! += (targetB - state.lissB!) * α;

  // ── Phase accumulates continuously — audio energy speeds it up ──
  // At silence: ~0.008 rad/frame → full cycle ≈ 13 s
  // At full signal: ~0.025 rad/frame → full cycle ≈ 4 s
  state.lissPhase! += 0.008 + data.overallLevel * 0.017;

  const a     = state.lissA!;
  const b     = state.lissB!;
  const delta = state.lissPhase!;

  // Build trace (1200 points for smooth curve)
  const steps = 1200;
  const trace: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    trace.push({
      x: cx + r * Math.sin(a * t + delta),
      y: cy + r * Math.sin(b * t),
    });
  }

  // Persistence buffer — keep last 6 frames for afterglow
  state.traceHistory!.unshift(trace);
  if (state.traceHistory!.length > 6) state.traceHistory!.pop();

  // Draw persistence traces (oldest = most faded)
  ctx.shadowColor = '#1d6fff';
  state.traceHistory!.forEach((tr, idx) => {
    const age   = idx / state.traceHistory!.length;
    const alpha = (1 - age) * (0.22 + data.overallLevel * 0.5);
    ctx.strokeStyle = `rgba(29,111,255,${alpha})`;
    ctx.lineWidth   = Math.max(0.4, 1.6 - idx * 0.25);
    ctx.shadowBlur  = Math.max(0, 8 - idx * 1.8);
    ctx.beginPath();
    tr.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  });
  ctx.shadowBlur = 0;

  // Coordinate readout
  const fs = Math.max(9, w * 0.022);
  ctx.font = `${fs}px monospace`;
  ctx.fillStyle = 'rgba(100,160,255,0.42)';
  ctx.textAlign = 'right';
  ctx.fillText(`SEC: -45° 32' 52.3"`,                                    w * 0.96, h * 0.09);
  ctx.fillText(`DEC: 520 43' ${(52 + data.overallLevel * 5).toFixed(1)}"`, w * 0.96, h * 0.15);
  ctx.fillText(`MAG: ${(10 + data.overallLevel * 5).toFixed(1)}`,         w * 0.96, h * 0.21);
};

// ---------------------------------------------------------------------------
// SPARKS — particle explosion (이퀄5 레퍼런스)
// Fireworks sparks on black, beat-triggered bursts, gravity + trail
// ---------------------------------------------------------------------------
const drawSparks: DrawFn = (ctx, w, h, data, _time, state) => {
  if (!state.particles)    state.particles    = [];
  if (!state.prevBass)     state.prevBass     = 0;
  if (!state.beatCooldown) state.beatCooldown = 0;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const bass = data.bassLevel;

  // Beat detection
  state.beatCooldown = Math.max(0, state.beatCooldown - 1);
  const isBeat = bass > (state.prevBass ?? 0) + 0.12 && bass > 0.25 && state.beatCooldown === 0;

  if (isBeat) {
    const count = Math.floor(18 + bass * 55);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * (2.5 + bass * 5);
      state.particles!.push({
        x: cx + (Math.random() - 0.5) * 8,
        y: cy + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 0.8,
        life: 1, maxLife: 0.5 + Math.random() * 0.9,
        size: 1 + Math.random() * 2.5,
        hue: 15 + Math.random() * 35,
      });
    }
    state.beatCooldown = 7;
  }

  // Ambient trickle
  if (bass > 0.08 && Math.random() < bass * 0.5) {
    const angle = Math.random() * Math.PI * 2;
    state.particles!.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * (0.4 + Math.random() * 1.8),
      vy: Math.sin(angle) * (0.4 + Math.random() * 1.8) - 0.4,
      life: 1, maxLife: 0.3 + Math.random() * 0.5,
      size: 0.7 + Math.random() * 1.4, hue: 20 + Math.random() * 30,
    });
  }

  const dt = 1 / 60;
  state.particles = state.particles!.filter(p => p.life > 0);
  for (const p of state.particles) {
    p.x  += p.vx; p.y  += p.vy;
    p.vy += 0.045; p.vx *= 0.99;
    p.life -= dt / p.maxLife;
    const bright = 50 + p.life * 50;
    ctx.fillStyle = `hsla(${p.hue},100%,${bright}%,${p.life})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center origin glow
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18 + bass * 28);
  cg.addColorStop(0, `rgba(255,200,100,${0.28 + bass * 0.5})`);
  cg.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(cx, cy, 18 + bass * 28, 0, Math.PI * 2); ctx.fill();

  state.prevBass = bass;
  if (state.particles.length > 450) state.particles = state.particles.slice(-450);
};

// ---------------------------------------------------------------------------
// MAGENTA — neon blob metaballs (이퀄6 레퍼런스)
// Pink blobs float + pulse, "Complete" label, screen blend
// ---------------------------------------------------------------------------
const drawMagenta: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  ctx.fillStyle = '#070707';
  ctx.fillRect(0, 0, w, h);

  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const blobs = [
    { ox: 0.40, oy: 0.46, ph: 0,   fr: 0.70, lvl: data.bassLevel   },
    { ox: 0.60, oy: 0.54, ph: 2.1, fr: 0.50, lvl: data.midLevel    },
    { ox: 0.50, oy: 0.34, ph: 4.2, fr: 0.90, lvl: data.trebleLevel },
  ];

  ctx.globalCompositeOperation = 'screen';
  for (const b of blobs) {
    const bx = (b.ox + Math.sin(time * b.fr + b.ph) * 0.09) * w;
    const by = (b.oy + Math.cos(time * b.fr * 0.7 + b.ph) * 0.09) * h;
    const r  = Math.min(w, h) * (0.14 + b.lvl * 0.22);
    const a  = 0.45 + b.lvl * 0.55;
    const g  = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0,   `rgba(${tr},${tg},${tb},${a})`);
    g.addColorStop(0.45,`rgba(${tr},${tg},${tb},${a * 0.55})`);
    g.addColorStop(1,   `rgba(${tr},${tg},${tb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // "Complete" label
  const fs = Math.max(14, w * 0.062);
  ctx.font = `bold ${fs}px "Times New Roman", serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'center';
  ctx.fillText('Complete', w / 2, h * 0.90);
  const tw = ctx.measureText('Complete').width;
  ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.8)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - tw / 2, h * 0.925);
  ctx.lineTo(w / 2 + tw / 2, h * 0.925);
  ctx.stroke();
};

// ---------------------------------------------------------------------------
// ETHER — soft cloud shape (이퀄7 레퍼런스)
// Light bg, organic blob morphs with mids, "SISSY SCREENS" aesthetic
// ---------------------------------------------------------------------------
const drawEther: DrawFn = (ctx, w, h, data, time, state) => {
  if (!state.blobAngles) {
    state.blobAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
  }

  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const baseR = Math.min(w, h) * 0.3;
  const { frequencyData, midLevel, overallLevel } = data;

  // Build morphing blob points
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = state.blobAngles![i];
    const bin   = Math.floor((i / 12) * frequencyData.length * 0.45);
    const amod  = (frequencyData[bin] / 255) * midLevel * 0.55;
    const tmod  = Math.sin(time * 0.55 + angle * 1.6) * 0.09;
    const r     = baseR * (0.82 + amod + tmod);
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }

  // Draw soft layered blob
  for (let layer = 4; layer >= 0; layer--) {
    const scale = 1 - layer * 0.13;
    const alpha = (0.07 + midLevel * 0.10) * (1 - layer * 0.18);
    ctx.fillStyle = `hsla(${205 + layer * 8},${55 + layer * 8}%,78%,${alpha})`;
    ctx.beginPath();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p    = pts[i];
      const next = pts[(i + 1) % n];
      const mx = cx + ((p.x + next.x) / 2 - cx) * scale;
      const my = cy + ((p.y + next.y) / 2 - cy) * scale;
      const sx = cx + (p.x - cx) * scale;
      const sy = cy + (p.y - cy) * scale;
      i === 0 ? ctx.moveTo(mx, my) : ctx.quadraticCurveTo(sx, sy, mx, my);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Corner label
  const fs = Math.max(12, w * 0.065);
  ctx.font = `bold ${fs}px "Arial Black", sans-serif`;
  ctx.fillStyle = `rgba(55,75,115,${0.22 + overallLevel * 0.28})`;
  ctx.textAlign = 'right';
  ctx.fillText('SISSY', w * 0.93, h * 0.18);
  ctx.fillText('SCREENS', w * 0.93, h * 0.28);
};

// ---------------------------------------------------------------------------
// RADIAL — circular bar visualizer (이퀄8 레퍼런스)
// 128 radial bars, white lines, red center dot, dark bg
// ---------------------------------------------------------------------------
const drawRadial: DrawFn = (ctx, w, h, data) => {
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const inner  = Math.min(w, h) * 0.12;
  const maxLen = Math.min(w, h) * 0.33;
  const { frequencyData, bassLevel, overallLevel } = data;
  const barCount = 128;

  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
    const bin   = Math.floor((i / barCount) * frequencyData.length);
    const val   = frequencyData[bin] / 255;
    const len   = val * maxLen * (0.5 + bassLevel * 0.75);
    const alpha = 0.35 + val * 0.65;
    ctx.strokeStyle = `rgba(235,235,235,${alpha})`;
    ctx.lineWidth   = (Math.PI * 2 * inner / barCount) * 0.65;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * (inner + len), cy + Math.sin(angle) * (inner + len));
    ctx.stroke();
  }

  // Inner rings
  ctx.lineWidth = 0.5;
  [0.35, 0.6, 0.85].forEach(s => {
    ctx.strokeStyle = 'rgba(200,200,200,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, inner * s, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.strokeStyle = `rgba(210,210,210,${0.35 + overallLevel * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.stroke();

  // Red center dot
  const dotR = 3 + bassLevel * 4.5;
  ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8 + bassLevel * 12;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
};

// ---------------------------------------------------------------------------
// TERRAIN — wireframe mesh (이미지이퀄3 레퍼런스)
// Dark bg, 3D-ish wave grid driven by frequency, amber glow, bold text
// ---------------------------------------------------------------------------
const drawTerrain: DrawFn = (ctx, w, h, data, _time, state) => {
  if (!state.phase) state.phase = 0;
  state.phase += 0.022 + data.overallLevel * 0.045;

  ctx.fillStyle = '#060404';
  ctx.fillRect(0, 0, w, h);

  const cols = 28, rows = 16;
  const { frequencyData, overallLevel } = data;

  const getHeight = (col: number, row: number) => {
    const bin  = Math.floor((col / cols) * frequencyData.length * 0.75);
    const aH   = (frequencyData[bin] / 255) * overallLevel * h * 0.22;
    const wave = Math.sin(col * 0.38 + state.phase! + row * 0.28) * h * 0.055;
    return aH + wave;
  };

  // Horizontal grid lines
  for (let row = 0; row < rows; row++) {
    const rowAlpha = 0.25 + (row / rows) * 0.55;
    ctx.strokeStyle = `rgba(200,115,38,${rowAlpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let col = 0; col < cols; col++) {
      const x = (col / (cols - 1)) * w;
      const baseY = (row / (rows - 1)) * h;
      const y = baseY - getHeight(col, row) * (row / rows);
      col === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Vertical grid lines (every other)
  for (let col = 0; col < cols; col += 2) {
    ctx.strokeStyle = 'rgba(155,75,18,0.22)';
    ctx.beginPath();
    for (let row = 0; row < rows; row++) {
      const x = (col / (cols - 1)) * w;
      const baseY = (row / (rows - 1)) * h;
      const y = baseY - getHeight(col, row) * (row / rows);
      row === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Text overlay
  const fs = Math.max(14, w * 0.075);
  ctx.font = `bold ${fs}px "Arial Black", sans-serif`;
  ctx.fillStyle = 'rgba(255,242,218,0.9)';
  ctx.textAlign = 'left';
  ctx.fillText('KNOW WHERE', w * 0.05, h * 0.3);
  ctx.fillText('TO START.', w * 0.05, h * 0.44);
  ctx.font = `${Math.max(9, w * 0.022)}px sans-serif`;
  ctx.fillStyle = 'rgba(200,175,135,0.38)';
  ctx.fillText('We find where to create real leverage,', w * 0.05, h * 0.54);
  ctx.fillText('and build the systems to capture it.', w * 0.05, h * 0.60);
};

// ---------------------------------------------------------------------------
// ORBIT — planet with atmospheric glow (이미지이퀄4 레퍼런스)
// Deep space, planet, orbital rings, "Authenticate" UI text
// ---------------------------------------------------------------------------
const drawOrbit: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  const cx = w / 2, cy = h * 0.52;
  const pR  = Math.min(w, h) * 0.2;
  const bass = data.bassLevel;
  const [tr, tg, tb] = hexRgb(preset.colorTint);

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
  bg.addColorStop(0, '#001130'); bg.addColorStop(1, '#000206');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  // Stars (stable pseudo-random)
  for (let i = 0; i < 42; i++) {
    const sx = (Math.sin(i * 2.31) * 0.5 + 0.5) * w;
    const sy = (Math.cos(i * 1.73) * 0.5 + 0.5) * h;
    ctx.fillStyle = `rgba(200,220,255,${0.3 + (i % 4) * 0.15})`;
    ctx.beginPath(); ctx.arc(sx, sy, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // Atmosphere glow
  for (let i = 4; i >= 0; i--) {
    const r = pR * (1.35 + i * 0.5 + bass * 0.85);
    const a = (0.055 - i * 0.009) * (0.45 + bass * 0.7);
    const g = ctx.createRadialGradient(cx, cy, pR, cx, cy, r);
    g.addColorStop(0,   `rgba(${tr},${tg},${tb},${a * 3.5})`);
    g.addColorStop(0.5, `rgba(${tr},${tg},${tb},${a})`);
    g.addColorStop(1,   `rgba(${tr},${tg},${tb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  // Orbital rings (perspective-flattened)
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.28);
  for (let ring = 0; ring < 3; ring++) {
    const rR = pR * (1.65 + ring * 0.5);
    const ra = (0.28 - ring * 0.07) * (0.4 + data.overallLevel * 0.5);
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${ra})`;
    ctx.lineWidth = 1.8 - ring * 0.45;
    ctx.beginPath(); ctx.arc(0, 0, rR, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // Planet body
  const pg = ctx.createRadialGradient(cx - pR * 0.3, cy - pR * 0.3, 0, cx, cy, pR);
  pg.addColorStop(0, '#1a2a3c'); pg.addColorStop(0.7, '#0b1624'); pg.addColorStop(1, '#040a12');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, pR, 0, Math.PI * 2); ctx.fill();

  // UI text
  const fs = Math.max(9, w * 0.022);
  ctx.font = `${fs}px monospace`;
  ctx.fillStyle = 'rgba(170,200,255,0.28)';
  ctx.textAlign = 'left';
  ctx.fillText('ANA.IDENTITY', w * 0.05, h * 0.12);

  ctx.font = `bold ${Math.max(14, w * 0.054)}px "Times New Roman", serif`;
  ctx.fillStyle = 'rgba(220,235,255,0.9)';
  ctx.textAlign = 'center';
  ctx.fillText('Authenticate', cx, h * 0.24);

  ctx.font = `${fs}px sans-serif`;
  ctx.fillStyle = 'rgba(155,180,220,0.38)';
  ctx.fillText('Secure bio-metric connection', cx, h * 0.32);

  // INITIALIZE UPLINK button
  const btnW = w * 0.52, btnH = h * 0.07, btnY = h * 0.88;
  ctx.strokeStyle = `rgba(${tr},${tg},${tb},${0.45 + bass * 0.5})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH);
  ctx.font = `${Math.max(9, w * 0.022)}px monospace`;
  ctx.fillStyle = `rgba(${tr},${tg},${tb},${0.65 + bass * 0.35})`;
  ctx.textAlign = 'center';
  ctx.fillText('INITIALIZE UPLINK  →', cx, btnY + btnH * 0.22);

  void time;
};

// ---------------------------------------------------------------------------
// PIXEL — scrolling dot-grid waterfall (이미지이퀄5 레퍼런스)
// Black bg, each cell = frequency amplitude, warm → cold gradient, pixel figure
// ---------------------------------------------------------------------------
const drawPixel: DrawFn = (ctx, w, h, data, _time, state) => {
  const cols = 40, rows = 24;
  if (!state.pixelGrid) {
    state.pixelGrid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const cW = w / cols, cH = h / rows;
  const { frequencyData } = data;

  // Scroll down
  for (let r = rows - 1; r > 0; r--)
    for (let c = 0; c < cols; c++)
      state.pixelGrid![r][c] = state.pixelGrid![r - 1][c] * 0.91;

  // New top row from frequency
  for (let c = 0; c < cols; c++) {
    const bin = Math.floor((c / cols) * frequencyData.length * 0.78);
    state.pixelGrid![0][c] = frequencyData[bin] / 255;
  }

  // Draw cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = state.pixelGrid![r][c];
      if (v < 0.045) continue;
      const sz = cW * 0.62;
      let cr: number, cg: number, cb: number;
      if (v > 0.72)      { cr = 255; cg = 225; cb = 185; }
      else if (v > 0.42) { cr = 255; cg = 135; cb = 45;  }
      else if (v > 0.22) { cr = 90;  cg = 175; cb = 255; }
      else               { cr = 35;  cg = 75;  cb = 155; }
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${v})`;
      ctx.fillRect(c * cW + (cW - sz) / 2, r * cH + (cH - sz) / 2, sz, sz);
    }
  }

  // Pixel-art walking figure (center)
  const fig = [
    [0,1,0],[0,1,0],[1,1,1],[0,1,0],[1,0,1],
  ];
  const fx = Math.floor(cols / 2) - 1;
  const fy = Math.floor(rows / 2) - 3;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  fig.forEach((row, ry) =>
    row.forEach((cell, fc) => {
      if (!cell) return;
      ctx.fillRect((fx + fc) * cW + cW * 0.1, (fy + ry) * cH + cH * 0.1, cW * 0.8, cH * 0.8);
    })
  );
};

// ---------------------------------------------------------------------------
// BLOOM — watercolor flowers (이미지이퀄6 레퍼런스)
// Cream bg, petals open/close with bass, pastel palette
// ---------------------------------------------------------------------------
const drawBloom: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  ctx.fillStyle = '#fdf5f0';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h * 0.44;
  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const overall = data.overallLevel;
  const bass = data.bassLevel;

  // Vase outline
  const vH = h * 0.22, vW = w * 0.11;
  ctx.strokeStyle = `rgba(${tr * 0.5},${tg * 0.5},${tb * 0.5},0.28)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - vW, cy + vH * 0.5);
  ctx.bezierCurveTo(cx - vW * 0.85, cy + vH, cx + vW * 0.85, cy + vH, cx + vW, cy + vH * 0.5);
  ctx.bezierCurveTo(cx + vW * 0.55, cy, cx - vW * 0.55, cy, cx - vW, cy + vH * 0.5);
  ctx.stroke();

  // Stems
  ctx.strokeStyle = 'rgba(75,125,55,0.38)';
  ctx.lineWidth = 1.4;
  const stemCount = 5;
  for (let i = 0; i < stemCount; i++) {
    const sa = ((i / stemCount) - 0.5) * Math.PI * 0.6;
    const sl = h * (0.18 + i * 0.025);
    ctx.beginPath();
    ctx.moveTo(cx, cy + vH * 0.28);
    ctx.quadraticCurveTo(
      cx + Math.sin(sa) * sl * 0.38, cy - sl * 0.48,
      cx + Math.sin(sa) * sl * 0.58, cy - sl
    );
    ctx.stroke();
  }

  // Flowers
  const palette: [number, number, number][] = [
    [tr, tg, tb], [255, 155, 75], [75, 155, 220], [220, 95, 155], [255, 198, 75],
  ];
  const positions = [
    { x: cx,            y: cy - h * 0.22, r: 0   },
    { x: cx - w * 0.10, y: cy - h * 0.14, r: 0.4 },
    { x: cx + w * 0.09, y: cy - h * 0.17, r:-0.3 },
    { x: cx - w * 0.05, y: cy - h * 0.28, r: 0.8 },
    { x: cx + w * 0.07, y: cy - h * 0.25, r:-0.6 },
  ];

  positions.forEach((fp, fi) => {
    const [cr, cg, cb] = palette[fi % palette.length];
    const petals  = 5 + (fi % 3);
    const petalR  = Math.min(w, h) * (0.038 + fi * 0.004 + bass * 0.028);
    const open    = 0.68 + overall * 0.32 + Math.sin(time * 0.75 + fi) * 0.1;

    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.rotate(fp.r + time * 0.04);

    for (let p = 0; p < petals; p++) {
      const angle = (p / petals) * Math.PI * 2;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.48)`;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * petalR * 0.82 * open,
        Math.sin(angle) * petalR * 0.82 * open,
        petalR * open, petalR * 0.38 * open,
        angle, 0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,245,200,0.82)';
    ctx.beginPath(); ctx.arc(0, 0, petalR * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
};

// ---------------------------------------------------------------------------
// HORIZON — sky-to-sunset gradient landscape (이미지이퀄7 레퍼런스)
// Blue-gray → orange gradient, audio-reactive mountain silhouettes, Spanish text
// ---------------------------------------------------------------------------
const drawHorizon: DrawFn = (ctx, w, h, data, time) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0,   '#273848');
  sky.addColorStop(0.38,'#3a4a5a');
  sky.addColorStop(0.68,'#8a4a2e');
  sky.addColorStop(1,   '#be3e0e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  const { frequencyData, overallLevel } = data;
  const layers = [
    { yBase: 0.63, amp: 0.14, spd: 0.28, col: 'rgba(28,44,58,0.68)', fs: 0.28 },
    { yBase: 0.70, amp: 0.11, spd: 0.48, col: 'rgba(38,28,22,0.80)', fs: 0.58 },
    { yBase: 0.77, amp: 0.09, spd: 0.80, col: 'rgba(18,14,10,0.92)', fs: 0.98 },
  ];

  for (const layer of layers) {
    ctx.fillStyle = layer.col;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 90; i++) {
      const x  = (i / 90) * w;
      const bin = Math.floor((i / 90) * frequencyData.length * layer.fs);
      const aH  = (frequencyData[bin] / 255) * overallLevel * h * layer.amp;
      const wH  = Math.sin(x * 0.019 + time * layer.spd) * h * layer.amp * 0.38;
      ctx.lineTo(x, layer.yBase * h - aH - wH);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }

  const fs = Math.max(14, w * 0.062);
  ctx.font = `bold ${fs}px "Times New Roman", serif`;
  ctx.fillStyle = 'rgba(242,232,212,0.88)';
  ctx.textAlign = 'left';
  ctx.fillText('hay un hombre', w * 0.06, h * 0.30);
  ctx.fillText('en el cielo', w * 0.06, h * 0.43);
  ctx.font = `${Math.max(9, w * 0.022)}px sans-serif`;
  ctx.fillStyle = 'rgba(200,178,155,0.38)';
  ctx.fillText('listen to this', w * 0.06, h * 0.53);
};

// ---------------------------------------------------------------------------
// SINGULARITY — Jon Hopkins music player (이미지이퀄8 레퍼런스)
// Dark slate, waveform, spectrum bars, queue panel
// ---------------------------------------------------------------------------
const drawSingularity: DrawFn = (ctx, w, h, data, time) => {
  ctx.fillStyle = '#1a1d23';
  ctx.fillRect(0, 0, w, h);

  const { frequencyData, bassLevel, overallLevel } = data;

  // Waveform area
  const waveCy = h * 0.26, waveAmp = h * 0.14;
  ctx.strokeStyle = 'rgba(175,198,218,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * w;
    const v = (frequencyData[Math.floor((i / 255) * (frequencyData.length - 1))] / 255) * 2 - 1;
    const y = waveCy + v * waveAmp * (0.5 + overallLevel * 0.8);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Center line
  ctx.strokeStyle = 'rgba(110,130,150,0.28)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0, waveCy); ctx.lineTo(w, waveCy); ctx.stroke();

  // Track info
  const fs1 = Math.max(11, w * 0.038);
  ctx.font = `bold ${fs1}px monospace`;
  ctx.fillStyle = 'rgba(198,212,228,0.9)';
  ctx.textAlign = 'left';
  ctx.fillText('Aetheral_Scan.flac', w * 0.04, h * 0.5);

  ctx.font = `${Math.max(9, w * 0.025)}px sans-serif`;
  ctx.fillStyle = 'rgba(135,158,178,0.58)';
  ctx.fillText('Jon Hopkins  —  Singularity', w * 0.04, h * 0.59);

  // Progress bar
  const progX = w * 0.04, progY = h * 0.68, progW = w * 0.92;
  const progress = (time % 60) / 60;
  ctx.fillStyle = 'rgba(75,98,118,0.38)';
  ctx.fillRect(progX, progY, progW, 2);
  ctx.fillStyle = `rgba(115,165,215,${0.68 + bassLevel * 0.32})`;
  ctx.fillRect(progX, progY, progW * progress, 2);

  // Spectrum
  const barCount = 52, barAreaY = h * 0.75, barAreaH = h * 0.2;
  for (let i = 0; i < barCount; i++) {
    const x  = (i / barCount) * w;
    const bW = w / barCount * 0.68;
    const bin = Math.floor((i / barCount) * frequencyData.length);
    const bH  = (frequencyData[bin] / 255) * barAreaH;
    ctx.fillStyle = `rgba(96,99,241,${0.38 + (frequencyData[bin] / 255) * 0.62})`;
    ctx.fillRect(x + w / barCount * 0.16, barAreaY + barAreaH - bH, bW, bH);
  }

  // Queue panel
  ctx.strokeStyle = 'rgba(78,88,100,0.38)'; ctx.lineWidth = 0.5;
  ctx.strokeRect(w * 0.58, h * 0.04, w * 0.38, h * 0.42);
  ctx.font = `${Math.max(9, w * 0.022)}px sans-serif`;
  ctx.fillStyle = 'rgba(135,152,168,0.48)';
  ctx.textAlign = 'center';
  ctx.fillText('Queue', w * 0.77, h * 0.10);
  ['Aetheral_Scan', 'Void_Resonance', 'Kinetic_Friction'].forEach((track, i) => {
    ctx.fillStyle = i === 0 ? 'rgba(195,210,225,0.7)' : 'rgba(135,152,168,0.38)';
    ctx.textAlign = 'left';
    ctx.fillText(track, w * 0.61, h * (0.18 + i * 0.10));
  });
};

// ---------------------------------------------------------------------------
// Preset → draw function map
// ---------------------------------------------------------------------------

const DRAW_FNS: Record<string, DrawFn> = {
  eclipse:     drawEclipse,
  waveform:    drawWaveform,
  lissajous:   drawLissajous,
  sparks:      drawSparks,
  magenta:     drawMagenta,
  ether:       drawEther,
  radial:      drawRadial,
  terrain:     drawTerrain,
  orbit:       drawOrbit,
  pixel:       drawPixel,
  bloom:       drawBloom,
  horizon:     drawHorizon,
  singularity: drawSingularity,
  custom:      drawRadial,
};

// ---------------------------------------------------------------------------
// Main canvas component
// ---------------------------------------------------------------------------

function EQCanvasInner({ preset, analyserData }: EQCanvasProps) {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const startRef        = useRef(performance.now());
  const rafRef          = useRef<number>(0);
  const stateRef        = useRef<DrawState>({});
  // Keep latest analyserData in a ref so RAF doesn't need to restart every frame
  const dataRef         = useRef(analyserData);
  const presetRef       = useRef(preset);

  useEffect(() => { dataRef.current   = analyserData; }, [analyserData]);
  useEffect(() => { presetRef.current = preset;       }, [preset]);

  // Reset per-preset state when preset changes
  useEffect(() => { stateRef.current = {}; }, [preset.id]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const time   = (performance.now() - startRef.current) / 1000;
    const p      = presetRef.current;
    const drawFn = DRAW_FNS[p.id] ?? drawRadial;
    drawFn(ctx, canvas.width, canvas.height, dataRef.current, time, stateRef.current, p);
    rafRef.current = requestAnimationFrame(draw);
  }, []); // stable — never recreated

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Resize observer — keeps canvas resolution matching DOM size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
    });
    ro.observe(parent);
    canvas.width  = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  return (
    <div className="w-full h-full" style={{ background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

const EQCanvas = dynamic(() => Promise.resolve(EQCanvasInner), { ssr: false });
export default EQCanvas;
