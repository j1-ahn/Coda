'use client';

import { useState, useCallback, useRef } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import { useSettingsStore } from '@/store/useSettingsStore';

interface PromptResult {
  image_prompts: string[];
  audio_prompt: string;
  lyrics: string;
  scene_suggestions?: Array<{
    time_range: string;
    description: string;
    vfx_hint: string;
    transition: string;
  }>;
}

interface AudioFeatures {
  bpm: number;
  key: string;
  energy_level: string;
  spectral_centroid_hz: number;
  spectral_bandwidth_hz: number;
  zero_crossing_rate: number;
  rms_mean: number;
  mood: string;
  duration_sec: number;
  onset_density: number;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className={`px-1.5 py-0.5 text-[8px] border transition-colors shrink-0 ${
        copied
          ? 'bg-ink-900 text-cream-100 border-ink-900'
          : 'border-cream-300 text-ink-400 hover:text-ink-900 hover:border-ink-500'
      }`}
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}

export default function PromptPanel() {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Audio analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState('');

  const backendUrl = useSettingsStore((s) => s.backendUrl);
  const audioTracks = useCodaStore((s) => s.audioTracks);
  const activeAudioId = useCodaStore((s) => s.activeAudioTrackId);
  const activeTrack = audioTracks.find((t) => t.id === activeAudioId);

  // ── Listen to current song → extract features → generate prompts ──
  const handleListenAndGenerate = useCallback(async () => {
    if (!activeTrack?.url || analyzing) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setAudioFeatures(null);

    const base = backendUrl || '';

    try {
      // Phase 1: Fetch audio and send to librosa
      setAnalysisPhase('오디오 분석 중… (librosa)');
      const audioRes = await fetch(activeTrack.url);
      if (!audioRes.ok) throw new Error('오디오 파일 로드 실패');
      const audioBlob = await audioRes.blob();

      const formData = new FormData();
      formData.append('file', audioBlob, activeTrack.fileName || 'audio.mp3');

      const featRes = await fetch(`${base}/api/audio-analysis/features`, {
        method: 'POST',
        body: formData,
      });
      if (!featRes.ok) throw new Error(`Feature extraction failed: HTTP ${featRes.status}`);
      const featData = await featRes.json();
      const features: AudioFeatures = featData.features;
      setAudioFeatures(features);

      // Phase 2: Send features + whisper segments to Ollama
      setAnalysisPhase('프롬프트 생성 중… (Ollama)');
      const whisperSegments = activeTrack.whisperSegments ?? [];
      const genRes = await fetch(`${base}/api/audio-analysis/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features,
          whisper_segments: whisperSegments.map((s) => ({
            start: s.start,
            end: s.end,
            text: s.text,
          })),
          model: useSettingsStore.getState().ollamaModel || 'gemma4:e4b',
        }),
      });
      if (!genRes.ok) throw new Error(`Prompt generation failed: HTTP ${genRes.status}`);
      const genData = await genRes.json();
      setResult({
        image_prompts: genData.image_prompts ?? [],
        audio_prompt: genData.audio_prompt ?? '',
        lyrics: genData.lyrics ?? '',
        scene_suggestions: genData.scene_suggestions ?? [],
      });
    } catch (e: any) {
      setError(e.message || '분석 실패');
    } finally {
      setAnalyzing(false);
      setAnalysisPhase('');
    }
  }, [activeTrack, analyzing, backendUrl]);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const base = backendUrl || '';
      const res = await fetch(`${base}/api/ollama/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          style_hint: style.trim() || undefined,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult({
        image_prompts: data.image_prompts ?? [],
        audio_prompt: data.audio_prompt ?? '',
        lyrics: data.lyrics ?? '',
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || '생성 실패');
      }
    } finally {
      setLoading(false);
    }
  }, [topic, style, loading, backendUrl]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── 오디오 분석 섹션 ─────────────────────────────────── */}
      {activeTrack?.url && (
        <div className="shrink-0 flex flex-col gap-2 p-3 border-b border-cream-300">
          <div className="flex items-center justify-between">
            <span className="label-caps text-ink-400 text-[9px]">AUDIO ANALYSIS</span>
            <span className="text-[8px] text-ink-300 truncate max-w-[140px]">
              {activeTrack.fileName}
            </span>
          </div>
          <button
            onClick={handleListenAndGenerate}
            disabled={analyzing}
            className={`w-full py-2 label-caps text-[10px] border transition-colors ${
              analyzing
                ? 'bg-cream-200 text-ink-300 border-cream-300 cursor-wait'
                : 'border-ink-500 text-ink-500 hover:bg-ink-500 hover:text-cream-100'
            }`}
          >
            {analyzing ? analysisPhase || 'ANALYZING…' : 'LISTEN & GENERATE'}
          </button>

          {/* Feature summary badges */}
          {audioFeatures && (
            <div className="flex flex-wrap gap-1">
              <FeatureBadge label="BPM" value={String(audioFeatures.bpm)} />
              <FeatureBadge label="KEY" value={audioFeatures.key} />
              <FeatureBadge label="MOOD" value={audioFeatures.mood} />
              <FeatureBadge label="ENERGY" value={audioFeatures.energy_level} />
              <FeatureBadge label="ONSET" value={`${audioFeatures.onset_density}/s`} />
            </div>
          )}
        </div>
      )}

      {/* ── 입력 섹션 ───────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col gap-2 p-3 border-b border-cream-300">
        <div className="flex items-center gap-2">
          <span className="label-caps text-ink-400 text-[9px] shrink-0">주제</span>
        </div>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={2}
          placeholder="비 오는 도시의 외로운 밤"
          className="w-full resize-none bg-cream-100 border border-cream-300 text-ink-900 text-xs p-2 outline-none
            placeholder:text-ink-300 focus:border-ink-500 transition-colors leading-relaxed"
        />
        <input
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="스타일 힌트 (선택): lo-fi, cinematic, neon..."
          className="w-full bg-cream-100 border border-cream-300 text-ink-900 text-[10px] p-1.5 outline-none
            placeholder:text-ink-300 focus:border-ink-500 transition-colors"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className={`w-full py-2 label-caps text-[10px] border transition-colors ${
            loading
              ? 'bg-cream-200 text-ink-300 border-cream-300 cursor-wait'
              : !topic.trim()
                ? 'bg-cream-200 text-ink-300 border-cream-300 cursor-not-allowed'
                : 'border-ink-900 bg-ink-900 text-cream-100 hover:bg-ink-500'
          }`}
        >
          {loading ? 'GENERATING…' : 'GENERATE'}
        </button>
        {error && (
          <p className="text-[10px] text-red-500 bg-red-50 border border-red-200 px-2 py-1">
            {error}
          </p>
        )}
      </div>

      {/* ── 결과 섹션 ───────────────────────────────────────── */}
      {result && (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">

          {/* 이미지 프롬프트 */}
          <section className="flex flex-col gap-1.5 p-3">
            <div className="flex items-center gap-2">
              <span className="label-caps text-[9px] text-ink-500">IMAGE PROMPTS</span>
              <span className="text-[8px] text-ink-300">Midjourney / Niji</span>
            </div>
            {result.image_prompts.map((p, i) => (
              <div key={i} className="flex gap-1.5">
                <p className="flex-1 min-w-0 text-[10px] text-ink-900 leading-relaxed bg-cream-200 p-2 border border-cream-300 break-words">
                  {p}
                </p>
                <CopyBtn text={p} />
              </div>
            ))}
          </section>

          {/* 오디오 프롬프트 */}
          {result.audio_prompt && (
            <section className="flex flex-col gap-1.5 p-3">
              <div className="flex items-center gap-2">
                <span className="label-caps text-[9px] text-ink-500">AUDIO PROMPT</span>
                <span className="text-[8px] text-ink-300">Music / Sound</span>
              </div>
              <div className="flex gap-1.5">
                <p className="flex-1 min-w-0 text-[10px] text-ink-900 leading-relaxed bg-cream-200 p-2 border border-cream-300 break-words">
                  {result.audio_prompt}
                </p>
                <CopyBtn text={result.audio_prompt} />
              </div>
            </section>
          )}

          {/* 가사 */}
          {result.lyrics && (
            <section className="flex flex-col gap-1.5 p-3">
              <div className="flex items-center gap-2">
                <span className="label-caps text-[9px] text-ink-500">LYRICS</span>
                <span className="text-[8px] text-ink-300">가사</span>
              </div>
              <div className="flex gap-1.5">
                <pre className="flex-1 min-w-0 text-[10px] text-ink-900 leading-relaxed bg-cream-200 p-2 border border-cream-300 whitespace-pre-wrap font-sans break-words">
                  {result.lyrics}
                </pre>
                <CopyBtn text={result.lyrics} />
              </div>
            </section>
          )}

          {/* 씬 제안 (오디오 분석에서만) */}
          {result.scene_suggestions && result.scene_suggestions.length > 0 && (
            <section className="flex flex-col gap-1.5 p-3">
              <div className="flex items-center gap-2">
                <span className="label-caps text-[9px] text-ink-500">SCENE SUGGESTIONS</span>
                <span className="text-[8px] text-ink-300">씬 구성 제안</span>
              </div>
              {result.scene_suggestions.map((s, i) => (
                <div key={i} className="text-[10px] bg-cream-200 border border-cream-300 p-2 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="label-caps text-[8px] text-ink-500">{s.time_range}</span>
                    <span className="text-[8px] text-ink-300">{s.transition}</span>
                    {s.vfx_hint && s.vfx_hint !== 'none' && (
                      <span className="text-[7px] px-1 py-px bg-ink-900 text-cream-100">
                        {s.vfx_hint.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-ink-900 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </section>
          )}

        </div>
      )}

      {/* 결과 없을 때 안내 */}
      {!result && !loading && !analyzing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-center px-4">
          <p className="text-[10px] text-ink-300 leading-relaxed">
            {activeTrack?.url
              ? 'LISTEN & GENERATE로 현재 곡을 분석하거나\n주제를 입력하여 프롬프트를 생성합니다'
              : '주제를 입력하면\n이미지 프롬프트 · 오디오 프롬프트 · 가사를\n한번에 생성합니다'
            }
          </p>
          <p className="text-[9px] text-ink-200 mt-1">
            Ollama ({useSettingsStore.getState().ollamaModel}) 필요
          </p>
        </div>
      )}

      {/* 로딩 중 */}
      {(loading || analyzing) && !result && (
        <div className="flex-1 flex items-center justify-center">
          <span className="label-caps text-[10px] text-ink-300 animate-pulse">
            {analyzing ? analysisPhase || '분석 중…' : 'LLM 생성 중…'}
          </span>
        </div>
      )}

    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function FeatureBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cream-200 border border-cream-300 text-[8px]">
      <span className="label-caps text-ink-400">{label}</span>
      <span className="text-ink-900 font-medium">{value}</span>
    </span>
  );
}
