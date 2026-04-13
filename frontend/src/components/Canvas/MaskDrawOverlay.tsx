'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

export default function MaskDrawOverlay() {
  const maskDrawingMode   = useCodaStore((s) => s.maskDrawingMode);
  const scenes            = useCodaStore((s) => s.scenes);
  const activeSceneId     = useCodaStore((s) => s.activeSceneId);
  const setLoopMaskPoints = useCodaStore((s) => s.setLoopMaskPoints);
  const setMaskDrawingMode = useCodaStore((s) => s.setMaskDrawingMode);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const points = activeScene?.effects.loopMaskPoints ?? [];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Use ref for points to avoid stale closure in event handlers
  const pointsRef = useRef(points);
  pointsRef.current = points;

  // Draw the polygon overlay
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pts = pointsRef.current;
    if (!pts.length) return;

    // Draw lines
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const sx = p.x * w, sy = p.y * h;
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    });
    // If polygon is closed (>=3 pts and last === first, we close path)
    if (pts.length >= 3) {
      const first = pts[0], last = pts[pts.length - 1];
      if (Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001) {
        ctx.closePath();
        // Fill closed polygon
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw points
    pts.forEach((p, i) => {
      const sx = p.x * w, sy = p.y * h;
      ctx.beginPath();
      ctx.arc(sx, sy, i === 0 ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? 'rgba(255,200,50,0.9)' : 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Instruction when no points yet
    if (pts.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Ctrl+Click to add points', w / 2, h / 2);
    }
  }, []);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = document.getElementById('studio-canvas-container');
    if (!container) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    });
    ro.observe(container);
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  // Redraw when points change
  useEffect(() => { draw(); }, [points, draw]);

  // Click handler
  const handleClick = useCallback((e: MouseEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top)  / rect.height;

    const pts = pointsRef.current;
    // Check if clicking near first point to close polygon
    if (pts.length >= 3) {
      const first = pts[0];
      const dx = (nx - first.x) * canvas.width;
      const dy = (ny - first.y) * canvas.height;
      if (Math.sqrt(dx * dx + dy * dy) < 14) {
        // Close: append first point to close the loop, then save
        if (!activeSceneId) return;
        const closed = [...pts, { x: first.x, y: first.y }];
        setLoopMaskPoints(activeSceneId, closed);
        setMaskDrawingMode(false);
        return;
      }
    }

    if (!activeSceneId) return;
    setLoopMaskPoints(activeSceneId, [...pts, { x: nx, y: ny }]);
  }, [activeSceneId, setLoopMaskPoints, setMaskDrawingMode]);

  // ESC = remove last point
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && maskDrawingMode) {
      const pts = pointsRef.current;
      if (pts.length > 0 && activeSceneId) {
        setLoopMaskPoints(activeSceneId, pts.slice(0, -1));
      }
    }
  }, [maskDrawingMode, activeSceneId, setLoopMaskPoints]);

  useEffect(() => {
    const container = document.getElementById('studio-canvas-container');
    if (!container) return;
    container.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClick, handleKeyDown]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 50, cursor: maskDrawingMode ? 'crosshair' : 'default' }}
    />
  );
}
