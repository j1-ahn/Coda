'use client';

import { useRef, useEffect } from 'react';
import { useCodaStore } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// EQOverlayWidget — chrome only (drag handle, resize handles, flip, close)
// Uses position:fixed so it lives OUTSIDE #studio-canvas-container.
// The actual EQ canvas is rendered by EQCanvasLayer inside the container,
// which is the only thing captured during video export.
// ---------------------------------------------------------------------------

export default function EQOverlayWidget() {
  const visible           = useCodaStore((s) => s.eqOverlayVisible);
  const flipX             = useCodaStore((s) => s.eqFlipX);
  const flipY             = useCodaStore((s) => s.eqFlipY);
  const ox = useCodaStore((s) => s.eqOverlayX);
  const oy = useCodaStore((s) => s.eqOverlayY);
  const ow = useCodaStore((s) => s.eqOverlayW);
  const oh = useCodaStore((s) => s.eqOverlayH);
  const setEqOverlayGeometry = useCodaStore((s) => s.setEqOverlayGeometry);
  const setEqOverlayVisible  = useCodaStore((s) => s.setEqOverlayVisible);
  const setEqFlip            = useCodaStore((s) => s.setEqFlip);

  const dragging    = useRef(false);
  const resizeEdge  = useRef<'top' | 'bottom' | 'left' | 'right' | null>(null);
  const dragStart   = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0, ow: 0, oh: 0 });

  // Container rect — used to translate container-relative ox/oy to fixed screen coords
  const getContainerRect = () => {
    const el = document.getElementById('studio-canvas-container');
    return el ? el.getBoundingClientRect() : null;
  };

  // Global mouse move / up
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const cr = getContainerRect();
      if (!cr) return;
      const cw = cr.width, ch = cr.height;

      if (dragging.current) {
        const dx = (e.clientX - dragStart.current.mx) / cw * 100;
        const dy = (e.clientY - dragStart.current.my) / ch * 100;
        const nx = Math.max(0, Math.min(dragStart.current.ox + dx, 100 - ow));
        const ny = Math.max(0, Math.min(dragStart.current.oy + dy, 100 - oh));
        setEqOverlayGeometry(nx, ny, ow, oh);
      }
      if (resizeEdge.current === 'bottom') {
        const dh = (e.clientY - resizeStart.current.my) / ch * 100;
        const newH = Math.max(5, resizeStart.current.oh + dh);
        // 하단이 컨테이너 밖으로 나가지 않도록 클램핑
        setEqOverlayGeometry(ox, oy, ow, Math.min(newH, 100 - oy));
      }
      if (resizeEdge.current === 'top') {
        const dh = (e.clientY - resizeStart.current.my) / ch * 100;
        const nh = Math.max(5, resizeStart.current.oh - dh);
        const ny = Math.max(0, resizeStart.current.oy + dh);
        setEqOverlayGeometry(ox, ny, ow, nh);
      }
      if (resizeEdge.current === 'right') {
        const dw = (e.clientX - resizeStart.current.mx) / cw * 100;
        const newW = Math.max(10, resizeStart.current.ow + dw);
        // 우측이 컨테이너 밖으로 나가지 않도록 클램핑
        setEqOverlayGeometry(ox, oy, Math.min(newW, 100 - ox), oh);
      }
      if (resizeEdge.current === 'left') {
        const dw = (e.clientX - resizeStart.current.mx) / cw * 100;
        const nw = Math.max(10, resizeStart.current.ow - dw);
        const nx = Math.max(0, resizeStart.current.ox + dw);
        setEqOverlayGeometry(nx, oy, nw, oh);
      }
    };
    const onUp = () => { dragging.current = false; resizeEdge.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [ox, oy, ow, oh, setEqOverlayGeometry]);

  if (!visible) return null;

  // 컨테이너 밖으로 삐져나오지 않도록 렌더 시 클램핑
  const safeOx = Math.max(0, Math.min(ox, 100 - ow));
  const safeOy = Math.max(0, Math.min(oy, 100 - oh));

  return (
    <div
      className="absolute z-50 select-none pointer-events-none"
      style={{ left: `${safeOx}%`, top: `${safeOy}%`, width: `${ow}%`, height: `${oh}%` }}
    >
      {/* Top resize handle */}
      <div
        className="h-1 cursor-ns-resize w-full pointer-events-auto"
        style={{ background: 'rgba(255,255,255,0.12)' }}
        onMouseDown={(e) => {
          e.preventDefault();
          resizeEdge.current = 'top';
          resizeStart.current = { mx: e.clientX, my: e.clientY, ox, oy, ow, oh };
        }}
      />

      {/* Middle row: left handle + header + right handle */}
      <div className="flex items-stretch pointer-events-auto">
        {/* Left resize handle */}
        <div
          className="w-1 cursor-ew-resize shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          onMouseDown={(e) => {
            e.preventDefault();
            resizeEdge.current = 'left';
            resizeStart.current = { mx: e.clientX, my: e.clientY, ox, oy, ow, oh };
          }}
        />

        {/* Header bar — drag handle */}
        <div
          className="flex items-center gap-1 px-2 h-5 bg-black/70 backdrop-blur-sm cursor-grab active:cursor-grabbing flex-1"
          onMouseDown={(e) => {
            e.preventDefault();
            dragging.current = true;
            dragStart.current = { mx: e.clientX, my: e.clientY, ox, oy };
          }}
        >
          <span className="text-[8px] label-caps text-white/50 flex-1 pointer-events-none">EQ</span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setEqFlip(!flipX, flipY)}
            className={`text-[9px] px-1 ${flipX ? 'text-white' : 'text-white/35'} hover:text-white`}
            title="Flip Horizontal"
          >⇔</button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setEqFlip(flipX, !flipY)}
            className={`text-[9px] px-1 ${flipY ? 'text-white' : 'text-white/35'} hover:text-white`}
            title="Flip Vertical"
          >⇕</button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setEqOverlayVisible(false)}
            className="text-[9px] px-1 text-white/35 hover:text-white"
            title="Close"
          >✕</button>
        </div>

        {/* Right resize handle */}
        <div
          className="w-1 cursor-ew-resize shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          onMouseDown={(e) => {
            e.preventDefault();
            resizeEdge.current = 'right';
            resizeStart.current = { mx: e.clientX, my: e.clientY, ox, oy, ow, oh };
          }}
        />
      </div>

      {/* Canvas area outline (visual only — actual canvas is EQCanvasLayer) */}
      <div
        className="flex pointer-events-auto"
        style={{ height: `${oh}%` }}
      >
        {/* Left resize handle */}
        <div
          className="w-1 cursor-ew-resize shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          onMouseDown={(e) => {
            e.preventDefault();
            resizeEdge.current = 'left';
            resizeStart.current = { mx: e.clientX, my: e.clientY, ox, oy, ow, oh };
          }}
        />
        {/* Transparent middle — canvas is visible through here */}
        <div className="flex-1" style={{ background: 'transparent', cursor: 'default' }} />
        {/* Right resize handle */}
        <div
          className="w-1 cursor-ew-resize shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          onMouseDown={(e) => {
            e.preventDefault();
            resizeEdge.current = 'right';
            resizeStart.current = { mx: e.clientX, my: e.clientY, ox, oy, ow, oh };
          }}
        />
      </div>

      {/* Bottom resize handle */}
      <div
        className="h-1 cursor-ns-resize w-full pointer-events-auto"
        style={{ background: 'rgba(255,255,255,0.12)' }}
        onMouseDown={(e) => {
          e.preventDefault();
          resizeEdge.current = 'bottom';
          resizeStart.current = { mx: e.clientX, my: e.clientY, ox, oy, ow, oh };
        }}
      />
    </div>
  );
}
