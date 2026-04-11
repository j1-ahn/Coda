'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { AudioAnalyserData } from '@/hooks/useAudioAnalyser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EQPreset {
  id: string;
  name: string;
  reactMode: 'original' | 'pulse' | 'ripple' | 'chromatic' | 'warp';
  colorTint: string;
  imagePath?: string; // kept for compat — not used in rendering
}

interface EQCanvasProps {
  preset: EQPreset;
  analyserData: AudioAnalyserData;
  intensity?: number;    // 0–1 globalAlpha multiplier (default 1)
  sensitivity?: number;  // 0.1–3.0 audio level multiplier (default 1)
  // Optional: if provided, RAF reads from this ref directly (no React re-renders needed)
  externalDataRef?: { current: AudioAnalyserData };
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
  lissA?: number;
  lissB?: number;
  lissPhase?: number;
  // React mode overlay state
  rmFlash?: number;
  rmRipples?: { r: number; alpha: number }[];
  rmPrevBass?: number;
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

  ctx.clearRect(0, 0, w, h);

  // Corona glow layers (outermost first)
  for (let i = 5; i >= 0; i--) {
    const r = baseR * (1.5 + i * 0.45 + bass * 2.4);
    const a = (0.07 - i * 0.01) * (0.4 + bass * 1.6);
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
    const str = (frequencyData[bin] / 255) * (0.5 + bass * 1.1);
    const len = baseR * (0.2 + str * 3.2);
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
const drawWaveform: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const [tr, tg, tb] = hexRgb(preset.colorTint);

  // CRT grid
  ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.10)`;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 6; i++) {
    const y = (i / 6) * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }

  const { frequencyData, overallLevel } = data;
  const cy = h * 0.5;
  const amp = h * 0.36 * (0.3 + overallLevel * 2.2);

  for (let pass = 0; pass < 3; pass++) {
    const alpha = pass === 2 ? 0.95 : 0.25 - pass * 0.08;
    const lw    = pass === 2 ? 1.5 : 4 - pass * 1.5;
    const r2 = Math.min(255, tr + pass * 10);
    const g2 = Math.min(255, tg + pass * 10);
    const b2 = Math.min(255, tb + pass * 10);
    ctx.strokeStyle = `rgba(${r2},${g2},${b2},${alpha})`;
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
};

// ---------------------------------------------------------------------------
// LISSAJOUS — parametric figure (이퀄4 레퍼런스)
// Blue Lissajous curve, persistence traces, dark blue bg.
// a:b는 고정 비율(3:2)을 기반으로 exponential smoothing으로 매우 서서히 변화.
// 위상 delta는 연속적으로 누적되어 도형이 부드럽게 회전/변형됨.
// ---------------------------------------------------------------------------
const drawLissajous: DrawFn = (ctx, w, h, data, time, state, preset) => {
  if (!state.traceHistory)  state.traceHistory  = [];
  if (state.lissA      === undefined) state.lissA      = 3.0;
  if (state.lissB      === undefined) state.lissB      = 2.0;
  if (state.lissPhase  === undefined) state.lissPhase  = 0.0;

  ctx.clearRect(0, 0, w, h);

  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * (0.28 + data.overallLevel * 0.14);

  ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.13)`;
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
  // At silence: ~0.006 rad/frame → full cycle ≈ 17 s
  // At full signal: ~0.055 rad/frame → full cycle ≈ 2 s
  state.lissPhase! += 0.006 + data.overallLevel * 0.049;

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

  ctx.shadowColor = `rgb(${tr},${tg},${tb})`;
  state.traceHistory!.forEach((traceEntry, idx) => {
    const age   = idx / state.traceHistory!.length;
    const alpha = (1 - age) * (0.22 + data.overallLevel * 0.5);
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${alpha})`;
    ctx.lineWidth   = Math.max(0.4, 1.6 - idx * 0.25);
    ctx.shadowBlur  = Math.max(0, 8 - idx * 1.8);
    ctx.beginPath();
    traceEntry.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  });
  ctx.shadowBlur = 0;

  // Timer (music playback time) + level readout (top-right)
  const fs  = Math.max(9, w * 0.022);
  const pt  = data.currentTime ?? 0;
  const mm  = String(Math.floor(pt / 60)).padStart(2, '0');
  const ss  = String(Math.floor(pt % 60)).padStart(2, '0');
  const cs  = String(Math.floor((pt % 1) * 100)).padStart(2, '0');
  ctx.font = `${fs}px monospace`;
  ctx.fillStyle = `rgba(${tr},${tg},${Math.min(255,tb+80)},0.42)`;
  ctx.textAlign = 'right';
  ctx.fillText(`${mm}:${ss}:${cs}`,                                       w * 0.96, h * 0.09);
  ctx.fillText(`BAS ${(data.bassLevel * 100).toFixed(0).padStart(3,' ')}`, w * 0.96, h * 0.15);
  ctx.fillText(`MID ${(data.midLevel  * 100).toFixed(0).padStart(3,' ')}`, w * 0.96, h * 0.21);
};

// ---------------------------------------------------------------------------
// SPARKS — particle explosion (이퀄5 레퍼런스)
// Fireworks sparks on black, beat-triggered bursts, gravity + trail
// ---------------------------------------------------------------------------
const drawSparks: DrawFn = (ctx, w, h, data, _time, state) => {
  if (!state.particles)    state.particles    = [];
  if (!state.prevBass)     state.prevBass     = 0;
  if (!state.beatCooldown) state.beatCooldown = 0;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const bass = data.bassLevel;

  // Beat detection
  state.beatCooldown = Math.max(0, state.beatCooldown - 1);
  const isBeat = bass > (state.prevBass ?? 0) + 0.08 && bass > 0.15 && state.beatCooldown === 0;

  if (isBeat) {
    const count = Math.floor(25 + bass * 90);
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
    // Guard: life can go negative after decrement — skip draw to avoid
    // ctx.arc() DOMException ("radius is negative")
    if (p.life <= 0) continue;
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
  ctx.clearRect(0, 0, w, h);

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
    const r  = Math.min(w, h) * (0.10 + b.lvl * 0.38);
    const a  = 0.35 + b.lvl * 0.65;
    const g  = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0,   `rgba(${tr},${tg},${tb},${a})`);
    g.addColorStop(0.45,`rgba(${tr},${tg},${tb},${a * 0.55})`);
    g.addColorStop(1,   `rgba(${tr},${tg},${tb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

};

// ---------------------------------------------------------------------------
// ETHER — soft cloud shape (이퀄7 레퍼런스)
// Light bg, organic blob morphs with mids, "SISSY SCREENS" aesthetic
// ---------------------------------------------------------------------------
const drawEther: DrawFn = (ctx, w, h, data, time, state, preset) => {
  if (!state.blobAngles) {
    state.blobAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
  }

  ctx.clearRect(0, 0, w, h);

  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const cx = w / 2, cy = h / 2;
  const baseR = Math.min(w, h) * 0.3;
  const { frequencyData, midLevel, overallLevel } = data;

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = state.blobAngles![i];
    const bin   = Math.floor((i / 12) * frequencyData.length * 0.45);
    const amod  = (frequencyData[bin] / 255) * midLevel * 0.55;
    const tmod  = Math.sin(time * 0.55 + angle * 1.6) * 0.09;
    const r     = baseR * (0.82 + amod + tmod);
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }

  for (let layer = 4; layer >= 0; layer--) {
    const scale = 1 - layer * 0.13;
    const alpha = (0.07 + midLevel * 0.10) * (1 - layer * 0.18);
    const lr = Math.min(255, tr + layer * 8);
    const lg = Math.min(255, tg + layer * 8);
    const lb = Math.min(255, tb + layer * 8);
    ctx.fillStyle = `rgba(${lr},${lg},${lb},${alpha})`;
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

};

// ---------------------------------------------------------------------------
// RADIAL — circular bar visualizer (이퀄8 레퍼런스)
// 128 radial bars, white lines, red center dot, dark bg
// ---------------------------------------------------------------------------
const drawRadial: DrawFn = (ctx, w, h, data, _t, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const cx = w / 2, cy = h / 2;
  const inner  = Math.min(w, h) * 0.12;
  const maxLen = Math.min(w, h) * 0.33;
  const { frequencyData, bassLevel, overallLevel } = data;
  const barCount = 128;

  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
    const bin   = Math.floor((i / barCount) * frequencyData.length);
    const val   = frequencyData[bin] / 255;
    const len   = val * maxLen * (0.4 + bassLevel * 1.4);
    const alpha = 0.35 + val * 0.65;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${alpha})`;
    ctx.lineWidth   = (Math.PI * 2 * inner / barCount) * 0.65;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * (inner + len), cy + Math.sin(angle) * (inner + len));
    ctx.stroke();
  }

  ctx.lineWidth = 0.5;
  [0.35, 0.6, 0.85].forEach(s => {
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.18)`;
    ctx.beginPath(); ctx.arc(cx, cy, inner * s, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.strokeStyle = `rgba(${tr},${tg},${tb},${0.35 + overallLevel * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.stroke();

  const dotR = 3 + bassLevel * 4.5;
  ctx.shadowColor = `rgb(${tr},${tg},${tb})`; ctx.shadowBlur = 8 + bassLevel * 12;
  ctx.fillStyle = `rgb(${tr},${tg},${tb})`;
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

  ctx.clearRect(0, 0, w, h);

  const cols = 28, rows = 16;
  const { frequencyData, overallLevel } = data;

  const getHeight = (col: number, row: number) => {
    const bin  = Math.floor((col / cols) * frequencyData.length * 0.75);
    const aH   = (frequencyData[bin] / 255) * overallLevel * h * 0.42;
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

  ctx.clearRect(0, 0, w, h);

  // Stars (stable pseudo-random)
  for (let i = 0; i < 42; i++) {
    const sx = (Math.sin(i * 2.31) * 0.5 + 0.5) * w;
    const sy = (Math.cos(i * 1.73) * 0.5 + 0.5) * h;
    ctx.fillStyle = `rgba(200,220,255,${0.3 + (i % 4) * 0.15})`;
    ctx.beginPath(); ctx.arc(sx, sy, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // Atmosphere glow
  for (let i = 4; i >= 0; i--) {
    const r = pR * (1.35 + i * 0.5 + bass * 1.8);
    const a = (0.055 - i * 0.009) * (0.4 + bass * 1.4);
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

  // Core light source — layered radial glows, no solid body
  const glowLayers = 7;
  ctx.globalCompositeOperation = 'screen';
  for (let i = glowLayers; i >= 0; i--) {
    const r  = pR * (0.18 + i * 0.42 + bass * 1.6);
    const a  = (0.22 - i * 0.025) * (0.5 + bass * 1.2 + data.overallLevel * 0.5);
    const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,    `rgba(${tr},${tg},${tb},${Math.min(a * 5, 1)})`);
    g.addColorStop(0.3,  `rgba(${tr},${tg},${tb},${a * 1.8})`);
    g.addColorStop(0.7,  `rgba(${tr},${tg},${tb},${a * 0.5})`);
    g.addColorStop(1,    `rgba(${tr},${tg},${tb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  // Hot white core
  const coreR = pR * 0.08 + bass * pR * 0.12;
  const cg2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  cg2.addColorStop(0, 'rgba(255,255,255,0.95)');
  cg2.addColorStop(0.5, `rgba(${tr},${tg},${tb},0.6)`);
  cg2.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
  ctx.fillStyle = cg2;
  ctx.beginPath(); ctx.arc(cx, cy, coreR * 2, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  void time;
};

// ---------------------------------------------------------------------------
// PIXEL — scrolling dot-grid waterfall (이미지이퀄5 레퍼런스)
// Black bg, each cell = frequency amplitude, warm → cold gradient, pixel figure
// ---------------------------------------------------------------------------
const drawPixel: DrawFn = (ctx, w, h, data, _time, state, preset) => {
  const cols = 40, rows = 24;
  if (!state.pixelGrid) {
    state.pixelGrid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  ctx.clearRect(0, 0, w, h);

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

  const [tr, tg, tb] = hexRgb(preset.colorTint);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = state.pixelGrid![r][c];
      if (v < 0.045) continue;
      const sz = cW * 0.62;
      let cr: number, cg: number, cbv: number;
      if (v > 0.72)      { cr = Math.min(255, tr + 80); cg = Math.min(255, tg + 80); cbv = Math.min(255, tb + 80); }
      else if (v > 0.42) { cr = tr; cg = tg; cbv = tb; }
      else if (v > 0.22) { cr = Math.round(tr * 0.7); cg = Math.round(tg * 0.7); cbv = Math.min(255, tb + 30); }
      else               { cr = Math.round(tr * 0.4); cg = Math.round(tg * 0.4); cbv = Math.round(tb * 0.6); }
      ctx.fillStyle = `rgba(${cr},${cg},${cbv},${v})`;
      ctx.fillRect(c * cW + (cW - sz) / 2, r * cH + (cH - sz) / 2, sz, sz);
    }
  }
};

// ---------------------------------------------------------------------------
// BLOOM — watercolor flowers (이미지이퀄6 레퍼런스)
// Cream bg, petals open/close with bass, pastel palette
// ---------------------------------------------------------------------------
const drawBloom: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const overall = data.overallLevel;
  const bass = data.bassLevel;
  const mid  = data.midLevel;

  // Pure watercolor bleed — colored blobs drift and spread, no flower shapes
  const palette: [number, number, number][] = [
    [tr, tg, tb], [255, 145, 65], [65, 145, 220], [220, 85, 155], [255, 195, 65],
  ];
  const nodes = [
    { x: 0.50, y: 0.42, lvl: bass   },
    { x: 0.34, y: 0.50, lvl: mid    },
    { x: 0.66, y: 0.45, lvl: mid    },
    { x: 0.45, y: 0.30, lvl: overall},
    { x: 0.58, y: 0.58, lvl: overall},
  ];

  nodes.forEach((node, ni) => {
    const [cr, cg, cb] = palette[ni % palette.length];
    const cx = (node.x + Math.sin(time * 0.28 + ni * 1.8) * 0.06) * w;
    const cy = (node.y + Math.cos(time * 0.22 + ni * 2.3) * 0.05) * h;

    // 3 diffusion layers: inner opaque core → outer transparent halo
    for (let layer = 0; layer < 3; layer++) {
      const blurPx = Math.max(2, Math.min(w, h) * (0.12 + layer * 0.10) * (0.7 + bass * 0.8 + node.lvl * 0.5));
      const bleedR = Math.min(w, h) * (0.12 + layer * 0.14 + node.lvl * 0.18 + bass * 0.12);
      const alpha  = (0.22 - layer * 0.07) * (0.4 + node.lvl * 0.9 + overall * 0.3);
      ctx.save();
      ctx.filter = `blur(${blurPx}px)`;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bleedR);
      g.addColorStop(0,   `rgba(${cr},${cg},${cb},${alpha})`);
      g.addColorStop(0.55,`rgba(${cr},${cg},${cb},${alpha * 0.45})`);
      g.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, bleedR, 0, Math.PI * 2); ctx.fill();
      ctx.filter = 'none';
      ctx.restore();
    }
  });
};

// ---------------------------------------------------------------------------
// HORIZON — sky-to-sunset gradient landscape (이미지이퀄7 레퍼런스)
// Blue-gray → orange gradient, audio-reactive mountain silhouettes, Spanish text
// ---------------------------------------------------------------------------
const drawHorizon: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  const { overallLevel, bassLevel, midLevel, trebleLevel } = data;
  // Shift hue base using colorTint
  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const hueShift = Math.round((tr / 255) * 40 - (tb / 255) * 40); // tint biases the palette
  void tg;

  // Pure gradient spread — audio levels shift the entire palette
  const h1 = 200 + hueShift + midLevel * 60  + bassLevel * 30;
  const h2 = 280 + hueShift + bassLevel * 40 - trebleLevel * 20;
  const h3 = 20  + hueShift + overallLevel * 40 - midLevel * 15;
  const h4 = 350 + hueShift + bassLevel * 25 + trebleLevel * 20;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0,    `hsl(${h1},${40 + midLevel * 28}%,${12 + midLevel * 12}%)`);
  bg.addColorStop(0.30, `hsl(${h2},${35 + bassLevel * 25}%,${18 + bassLevel * 14}%)`);
  bg.addColorStop(0.60, `hsl(${h3},${55 + overallLevel * 32}%,${28 + overallLevel * 16}%)`);
  bg.addColorStop(0.82, `hsl(${h4},${58 + bassLevel * 28}%,${22 + bassLevel * 14}%)`);
  bg.addColorStop(1,    `hsl(${h1 + 160},${38 + trebleLevel * 20}%,${10 + trebleLevel * 8}%)`);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  // Diagonal gradient that drifts with time
  const diagX = w * (0.35 + Math.sin(time * 0.08) * 0.22);
  const diagY = h * (0.45 + Math.cos(time * 0.06) * 0.18);
  for (let i = 3; i >= 0; i--) {
    const r = Math.max(w, h) * (0.3 + i * 0.22 + overallLevel * 0.35);
    const a = (0.10 - i * 0.022) * (0.5 + bassLevel * 1.4 + midLevel * 0.6);
    const rg = ctx.createRadialGradient(diagX, diagY, 0, diagX, diagY, r);
    rg.addColorStop(0,   `hsla(${h3},80%,65%,${a * 3.5})`);
    rg.addColorStop(0.4, `hsla(${h4},65%,55%,${a * 1.5})`);
    rg.addColorStop(1,   `hsla(${h2},50%,40%,0)`);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(diagX, diagY, r, 0, Math.PI * 2); ctx.fill();
  }

  // Second drifting light source
  const lx2 = w * (0.65 + Math.sin(time * 0.05 + 2) * 0.18);
  const ly2 = h * (0.55 + Math.cos(time * 0.07 + 1) * 0.15);
  const r2  = Math.max(w, h) * (0.25 + trebleLevel * 0.3);
  const rg2 = ctx.createRadialGradient(lx2, ly2, 0, lx2, ly2, r2);
  rg2.addColorStop(0,   `hsla(${h4 + 30},75%,68%,${0.18 + trebleLevel * 0.22})`);
  rg2.addColorStop(0.5, `hsla(${h2},60%,50%,${0.06 + midLevel * 0.10})`);
  rg2.addColorStop(1,   `hsla(${h1},40%,35%,0)`);
  ctx.fillStyle = rg2; ctx.beginPath(); ctx.arc(lx2, ly2, r2, 0, Math.PI * 2); ctx.fill();
};

// ---------------------------------------------------------------------------
// SINGULARITY — Jon Hopkins music player (이미지이퀄8 레퍼런스)
// Dark slate, waveform, spectrum bars, queue panel
// ---------------------------------------------------------------------------
const drawSingularity: DrawFn = (ctx, w, h, data, _t, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const { frequencyData, bassLevel, overallLevel } = data;

  const barCount = 64;
  const barW     = (w * 0.92) / barCount;
  const barX0    = w * 0.04;
  const maxBarH  = h * 0.82;

  for (let i = 0; i < barCount; i++) {
    const bin   = Math.floor((i / barCount) * frequencyData.length * 0.85);
    const val   = frequencyData[bin] / 255;
    const bH    = val * maxBarH * (0.35 + bassLevel * 1.0 + overallLevel * 0.5);
    const t     = i / (barCount - 1);
    const alpha = 0.38 + val * 0.62;
    const cr    = Math.min(255, Math.round(tr * (0.6 + t * 0.5)));
    const cg    = Math.min(255, Math.round(tg * (0.6 + t * 0.5)));
    const cbv   = Math.min(255, Math.round(tb * (0.7 + t * 0.4)));
    const grad  = ctx.createLinearGradient(0, h - bH, 0, h);
    grad.addColorStop(0,   `rgba(${Math.min(255,cr+40)},${Math.min(255,cg+40)},${Math.min(255,cbv+40)},${alpha})`);
    grad.addColorStop(1,   `rgba(${cr},${cg},${cbv},${alpha * 0.5})`);
    ctx.fillStyle = grad;
    ctx.fillRect(barX0 + i * barW + barW * 0.1, h - bH, barW * 0.8, bH);
    if (bH > 2) {
      ctx.fillStyle = `rgba(${Math.min(255,cr+80)},${Math.min(255,cg+80)},${Math.min(255,cbv+80)},${0.7 + val * 0.3})`;
      ctx.fillRect(barX0 + i * barW + barW * 0.1, h - bH - 2, barW * 0.8, 2);
    }
  }
};

// ---------------------------------------------------------------------------
// BASIC1 — oscilloscope multi-trace (eq0 reference)
// White bg, multiple overlapping sine traces, amplitude burst in mid-range
// ---------------------------------------------------------------------------
const drawBasic1: DrawFn = (ctx, w, h, data, _time, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const { frequencyData, overallLevel, bassLevel } = data;
  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const cy = h / 2;

  const offsets = [0, -h * 0.018, h * 0.018];
  offsets.forEach((offset, ti) => {
    const alpha = 0.55 + ti * 0.1;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${alpha})`;
    ctx.lineWidth   = 0.9 + ti * 0.2;
    ctx.beginPath();
    for (let i = 0; i < w; i++) {
      const bin = Math.floor((i / w) * frequencyData.length);
      const v   = (frequencyData[bin] / 255) * 2 - 1;
      const amp = h * (0.22 + overallLevel * 0.18 + bassLevel * 0.1);
      const y   = cy + offset + v * amp;
      i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
    }
    ctx.stroke();
  });

  // Center baseline
  ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.2)`;
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
};

// ---------------------------------------------------------------------------
// BASIC2 — gradient blob waveform (eq1 reference)
// Dark bg, layered semi-transparent filled waves, purple→pink gradient
// ---------------------------------------------------------------------------
const drawBasic2: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const { frequencyData, overallLevel, bassLevel, midLevel } = data;
  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const baseY = h * 0.62;

  // Derive 3 tonal variants from the tint color
  const layers = [
    { amp: 0.38, speed: 0.55, phase: 0,   colA: [Math.round(tr*0.6), Math.round(tg*0.6), Math.round(tb*0.9)], colB: [Math.min(255,tr+30), tg, Math.min(255,tb+30)] },
    { amp: 0.28, speed: 0.80, phase: 1.2, colA: [Math.round(tr*0.75), Math.round(tg*0.55), Math.min(255,tb+10)], colB: [Math.min(255,tr+50), Math.round(tg*0.85), Math.round(tb*0.85)] },
    { amp: 0.20, speed: 1.15, phase: 2.6, colA: [Math.min(255,tr+20), Math.round(tg*0.7), Math.min(255,tb+20)], colB: [Math.min(255,tr+80), Math.min(255,tg+40), Math.round(tb*0.75)] },
  ];

  layers.forEach((layer, li) => {
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0,   `rgba(${layer.colA[0]},${layer.colA[1]},${layer.colA[2]},0.65)`);
    gradient.addColorStop(0.5, `rgba(${Math.round((layer.colA[0]+layer.colB[0])/2)},${Math.round((layer.colA[1]+layer.colB[1])/2)},${Math.round((layer.colA[2]+layer.colB[2])/2)},0.55)`);
    gradient.addColorStop(1,   `rgba(${layer.colB[0]},${layer.colB[1]},${layer.colB[2]},0.65)`);
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= w; i++) {
      const bin = Math.floor((i / w) * frequencyData.length * 0.9);
      const v   = frequencyData[bin] / 255;
      const audioH = v * h * layer.amp * (0.5 + overallLevel * 0.9 + bassLevel * 0.5);
      const wave   = Math.sin((i / w) * Math.PI * (3 + li) + time * layer.speed + layer.phase) * h * 0.04 * (0.5 + midLevel * 0.8);
      ctx.lineTo(i, baseY - audioH - wave);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  });

};

// ---------------------------------------------------------------------------
// BASIC3 — classic spectrum bars (eq2 reference)
// Black bg, vertical bars, cyan→blue→purple→magenta color gradient
// ---------------------------------------------------------------------------
const drawBasic3: DrawFn = (ctx, w, h, data, _t, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const { frequencyData, bassLevel, overallLevel } = data;
  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const barCount = 52;
  const barW     = w / barCount;
  const maxH     = h * 0.88;

  for (let i = 0; i < barCount; i++) {
    const bin  = Math.floor((i / barCount) * frequencyData.length * 0.85);
    const val  = frequencyData[bin] / 255;
    const bH   = val * maxH * (0.35 + bassLevel * 1.0 + overallLevel * 0.4);
    const t    = i / (barCount - 1);

    // Gradient from tint color (darker left) to brighter right variant
    const cr = Math.min(255, Math.round(tr * (0.5 + t * 0.7)));
    const cg = Math.min(255, Math.round(tg * (0.5 + t * 0.7)));
    const cb = Math.min(255, Math.round(tb * (0.6 + t * 0.5)));

    const alpha = 0.4 + val * 0.6;
    // Gradient bar: brighter at top
    const grad = ctx.createLinearGradient(0, h - bH, 0, h);
    grad.addColorStop(0,   `rgba(${cr},${cg},${cb},${alpha})`);
    grad.addColorStop(0.6, `rgba(${cr},${cg},${cb},${alpha * 0.75})`);
    grad.addColorStop(1,   `rgba(${cr},${cg},${cb},${alpha * 0.35})`);
    ctx.fillStyle = grad;
    ctx.fillRect(i * barW + barW * 0.08, h - bH, barW * 0.84, bH);

    // Tiny cap dot at top
    if (bH > 3) {
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.75 + val * 0.25})`;
      ctx.fillRect(i * barW + barW * 0.08, h - bH - 2, barW * 0.84, 2);
    }
  }
};

// ---------------------------------------------------------------------------
// BASIC4 — pink filled smooth waveform (eq4 reference)
// Single filled waveform envelope, pink/rose, clean and minimal
// ---------------------------------------------------------------------------
const drawBasic4: DrawFn = (ctx, w, h, data, _t, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const { frequencyData, overallLevel, bassLevel } = data;
  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const baseY = h * 0.68;
  const maxAmp = h * 0.55;

  const grad = ctx.createLinearGradient(0, baseY - maxAmp, 0, baseY);
  grad.addColorStop(0,   `rgba(${tr},${tg},${tb},${0.55 + bassLevel * 0.35})`);
  grad.addColorStop(0.5, `rgba(${Math.min(255,tr+20)},${Math.min(255,tg+20)},${Math.min(255,tb+20)},${0.45 + overallLevel * 0.3})`);
  grad.addColorStop(1,   `rgba(${Math.min(255,tr+40)},${Math.min(255,tg+40)},${Math.min(255,tb+40)},0.15)`);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let i = 0; i <= w; i++) {
    const bin = Math.floor((i / w) * frequencyData.length * 0.9);
    const v   = frequencyData[bin] / 255;
    const y   = baseY - v * maxAmp * (0.3 + overallLevel * 1.0 + bassLevel * 0.5);
    ctx.lineTo(i, y);
  }
  ctx.lineTo(w, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(${tr},${Math.round(tg*0.7)},${Math.round(tb*0.8)},${0.55 + bassLevel * 0.35})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= w; i++) {
    const bin = Math.floor((i / w) * frequencyData.length * 0.9);
    const v   = frequencyData[bin] / 255;
    const y   = baseY - v * maxAmp * (0.3 + overallLevel * 1.0 + bassLevel * 0.5);
    i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
  }
  ctx.stroke();
};

// ---------------------------------------------------------------------------
// BASIC5 — teal flowing ribbon (eq5 reference)
// Multiple parallel sine waves weaving horizontally, teal/cyan palette
// ---------------------------------------------------------------------------
const drawBasic5: DrawFn = (ctx, w, h, data, time, _s, preset) => {
  ctx.clearRect(0, 0, w, h);

  const { overallLevel, bassLevel, midLevel, frequencyData } = data;
  const [tr, tg, tb] = hexRgb(preset.colorTint);
  const lineCount = 18;
  const cy = h / 2;

  for (let li = 0; li < lineCount; li++) {
    const t   = li / (lineCount - 1);
    const yOff = (t - 0.5) * h * 0.55;
    const alpha = (0.18 + (1 - Math.abs(t - 0.5) * 2) * 0.55) * (0.5 + overallLevel * 0.6);
    const r = Math.min(255, Math.round(tr * (0.6 + t * 0.5)));
    const g = Math.min(255, Math.round(tg * (0.6 + t * 0.5)));
    const b = Math.min(255, Math.round(tb * (0.7 + t * 0.4)));

    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth   = 0.9 + (1 - Math.abs(t - 0.5) * 2) * 0.8;
    ctx.beginPath();

    for (let xi = 0; xi <= w; xi++) {
      const bin  = Math.floor((xi / w) * frequencyData.length * 0.85);
      const freq = frequencyData[bin] / 255;

      const wave1 = Math.sin((xi / w) * Math.PI * 3.5 + time * (0.6 + li * 0.04)) * h * (0.06 + midLevel * 0.08);
      const wave2 = Math.sin((xi / w) * Math.PI * 7   + time * 1.2 + li * 0.5) * h * 0.025;
      const audioMod = freq * h * (0.04 + bassLevel * 0.06);

      const y = cy + yOff + wave1 + wave2 + audioMod;
      xi === 0 ? ctx.moveTo(xi, y) : ctx.lineTo(xi, y);
    }
    ctx.stroke();
  }
};

// ---------------------------------------------------------------------------
// React mode overlay — applied AFTER the main draw function
// pulse: beat flash | ripple: expanding rings | chromatic: RGB split |
// warp: radial scale pulse
// ---------------------------------------------------------------------------
function applyReactMode(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  data: AudioAnalyserData,
  time: number,
  state: DrawState,
  preset: EQPreset,
) {
  const bass    = data.bassLevel;
  const overall = data.overallLevel;

  // Beat detection (shared across all modes)
  if (state.rmPrevBass === undefined) { state.rmPrevBass = 0; state.rmFlash = 0; state.rmRipples = []; }
  const isBeat = bass > (state.rmPrevBass ?? 0) + 0.1 && bass > 0.18;
  state.rmPrevBass = bass;

  void time;

  switch (preset.reactMode) {

    case 'original':
      return; // no post-processing — preset draws itself

    case 'pulse': {
      // On beat → flash brightness overlay that decays
      if (isBeat) state.rmFlash = (state.rmFlash ?? 0) + 0.28;
      state.rmFlash = Math.max(0, (state.rmFlash ?? 0) - 0.035);
      if ((state.rmFlash ?? 0) > 0.005) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(state.rmFlash!, 0.28)})`;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }

    case 'ripple': {
      // On beat → spawn expanding ring
      if (isBeat) {
        state.rmRipples!.push({ r: Math.min(w, h) * 0.05, alpha: 0.55 });
      }
      // Grow + fade rings
      state.rmRipples = state.rmRipples!.filter(rp => rp.alpha > 0.01);
      const maxR = Math.max(w, h) * 0.75;
      for (const rp of state.rmRipples!) {
        rp.r     += (2.5 + overall * 4);
        rp.alpha *= 0.93;
        ctx.strokeStyle = `rgba(255,255,255,${rp.alpha})`;
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(rp.r, maxR), 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'chromatic': {
      // Chromatic aberration: shifted semi-transparent R and B channel ghosts
      const shift = 2 + bass * 6 + overall * 3;
      // Draw a faint red copy shifted right, blue copy shifted left
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.06 + bass * 0.10;
      ctx.drawImage(ctx.canvas, shift, 0);
      ctx.globalAlpha = 0.06 + bass * 0.10;
      ctx.drawImage(ctx.canvas, -shift, 0);
      ctx.restore();
      break;
    }

    case 'warp': {
      // Scale pulse from center on beats
      if (isBeat) {
        ctx.save();
        ctx.globalAlpha    = 0.18 + bass * 0.22;
        ctx.translate(w / 2, h / 2);
        const sc = 1.0 + bass * 0.04;
        ctx.scale(sc, sc);
        ctx.translate(-w / 2, -h / 2);
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.restore();
      }
      break;
    }
  }
}

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
  orbit:       drawOrbit,
  pixel:       drawPixel,
  bloom:       drawBloom,
  horizon:     drawHorizon,
  singularity: drawSingularity,
  basic1:      drawBasic1,
  basic2:      drawBasic2,
  basic3:      drawBasic3,
  basic4:      drawBasic4,
  basic5:      drawBasic5,
  custom:      drawRadial,
};

// ---------------------------------------------------------------------------
// Main canvas component
// ---------------------------------------------------------------------------

function EQCanvasInner({ preset, analyserData, intensity = 1, sensitivity = 1, externalDataRef }: EQCanvasProps) {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const startRef        = useRef(performance.now());
  const rafRef          = useRef<number>(0);
  const stateRef        = useRef<DrawState>({});
  const dataRef         = useRef(analyserData);
  const presetRef       = useRef(preset);
  // Capture externalDataRef once — it's a stable ref object
  const extRef          = externalDataRef;
  const intensityRef    = useRef(intensity);
  const sensitivityRef  = useRef(sensitivity);

  // Sync refs synchronously during render (safe — only reads, no side effects)
  dataRef.current       = analyserData;
  presetRef.current     = preset;
  intensityRef.current  = intensity;
  sensitivityRef.current = sensitivity;

  // Reset per-preset state when preset changes
  useEffect(() => { stateRef.current = {}; }, [preset.id]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const time   = (performance.now() - startRef.current) / 1000;
    const p      = presetRef.current;
    const rawData = extRef?.current ?? dataRef.current;
    const s = sensitivityRef.current;
    const data: AudioAnalyserData = s === 1 ? rawData : {
      ...rawData,
      bassLevel:    Math.min(1, rawData.bassLevel    * s),
      midLevel:     Math.min(1, rawData.midLevel     * s),
      trebleLevel:  Math.min(1, rawData.trebleLevel  * s),
      overallLevel: Math.min(1, rawData.overallLevel * s),
    };
    ctx.globalAlpha = 1;
    const drawFn = DRAW_FNS[p.id] ?? drawRadial;
    drawFn(ctx, canvas.width, canvas.height, data, time, stateRef.current, p);
    applyReactMode(ctx, canvas.width, canvas.height, data, time, stateRef.current, p);
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
    <div className="w-full h-full" style={{ background: 'transparent' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

export default EQCanvasInner;
