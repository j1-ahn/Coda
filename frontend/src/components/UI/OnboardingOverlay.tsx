'use client';

import { useState, useEffect } from 'react';

const LS_KEY = 'coda-onboarding-dismissed';

export default function OnboardingOverlay() {
  const [show, setShow] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem(LS_KEY);
    if (!dismissed) setShow(true);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    if (dontShowAgain) {
      localStorage.setItem(LS_KEY, 'true');
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#edeae3] border border-[#d4cfc6] shadow-2xl w-[420px] max-w-[90vw] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#d4cfc6]">
          <span className="font-serif italic text-[#1a1a16] text-3xl tracking-tight leading-none">
            Coda Studio
          </span>
          <p className="mt-1 text-[11px] text-[#6b6760] leading-relaxed">
            AI cinematic video generator for music creators
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {[
            { step: 1, title: 'Upload Image', desc: 'Drag your artwork or photo into the canvas' },
            { step: 2, title: 'Drop Audio', desc: 'Add your track to the bottom bar' },
            { step: 3, title: 'Style & Render', desc: 'Apply VFX, transitions, and export your video' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-[#c4a882] text-[#1a1a16] text-[11px] font-bold">
                {step}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[12px] font-semibold text-[#1a1a16] tracking-wide uppercase">
                  {title}
                </span>
                <span className="text-[11px] text-[#6b6760] leading-relaxed">
                  {desc}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#d4cfc6] flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#c4a882]"
            />
            <span className="text-[10px] text-[#9b9891]">Don't show again</span>
          </label>
          <button
            onClick={handleDismiss}
            className="px-5 py-2 bg-[#c4a882] text-[#1a1a16] text-[11px] font-semibold uppercase tracking-widest border border-[#a88c6a] hover:bg-[#d4bc9e] transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
