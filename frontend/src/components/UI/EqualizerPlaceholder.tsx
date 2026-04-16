'use client';

export default function EqualizerPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
      <span className="label-caps text-ink-300">EQUALIZER</span>
      <p className="text-ink-500 text-xs text-center leading-relaxed">
        Audio frequency-reactive image equalizer.<br />
        Select a preset image or upload your own.
      </p>
    </div>
  );
}
