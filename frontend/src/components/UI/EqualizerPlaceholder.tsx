'use client';

export default function EqualizerPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
      <span className="label-caps text-ink-300">EQUALIZER</span>
      <p className="text-ink-500 text-xs text-center leading-relaxed">
        오디오 주파수 반응형 이미지 이퀄라이저.<br />
        프리셋 이미지를 선택하거나 업로드하세요.
      </p>
    </div>
  );
}
