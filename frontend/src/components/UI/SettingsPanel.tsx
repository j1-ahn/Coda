'use client';

/**
 * SettingsPanel.tsx
 * Gear button → settings modal.
 * All settings persist automatically to localStorage via useSettingsStore.
 */

import { useState, useCallback } from 'react';
import { useSettingsStore, AppSettings } from '@/store/useSettingsStore';

// ── Gear icon ─────────────────────────────────────────────────────────────────

function GearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-7 h-7 flex items-center justify-center border border-cream-300
          text-ink-500 hover:text-ink-900 hover:border-ink-500 transition-colors"
        title="Settings"
      >
        <GearIcon />
      </button>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function SettingsModal({ onClose }: { onClose: () => void }) {
  const store = useSettingsStore();

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    store.set(k, v);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="w-[420px] max-h-[88vh] bg-cream-100 border border-cream-300 shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-300 shrink-0">
          <span className="label-caps text-ink-900">SETTINGS</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 transition-colors text-sm">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto divide-y divide-cream-300">

          {/* ── General ──────────────────────────────────────────────────── */}
          <Section title="일반">

            <SettingRow
              label="언어"
              description="UI 표시 언어. 적용 후 새로고침이 필요합니다."
            >
              <ToggleGroup
                options={[{ value: 'ko', label: 'KO' }, { value: 'en', label: 'EN' }]}
                value={store.language}
                onChange={(v) => set('language', v as AppSettings['language'])}
              />
            </SettingRow>

            <SettingRow
              label="자동저장 간격"
              description="변경사항을 브라우저 localStorage에 자동 저장하는 주기입니다. '끄기' 선택 시 SAVE 버튼으로만 저장됩니다."
            >
              <ToggleGroup
                options={[
                  { value: '30', label: '30s' },
                  { value: '60', label: '1m' },
                  { value: '0', label: '끄기' },
                ]}
                value={String(store.autoSaveInterval)}
                onChange={(v) => set('autoSaveInterval', Number(v) as AppSettings['autoSaveInterval'])}
              />
            </SettingRow>

          </Section>

          {/* ── Preview ──────────────────────────────────────────────────── */}
          <Section title="미리보기">

            <SettingRow
              label="캔버스 해상도"
              description="Three.js 씬의 내부 렌더 해상도입니다. 720p로 낮추면 GPU 부하가 줄어 편집이 빨라집니다. 실제 렌더 품질에는 영향을 주지 않습니다."
            >
              <ToggleGroup
                options={[
                  { value: '1920x1080', label: '1080p' },
                  { value: '1280x720', label: '720p' },
                ]}
                value={store.previewResolution}
                onChange={(v) => set('previewResolution', v as AppSettings['previewResolution'])}
              />
            </SettingRow>

            <SettingRow
              label="미리보기 DPR"
              description="Device Pixel Ratio. 2x는 레티나 디스플레이에서 선명하지만 VRAM을 2배 사용합니다. RTX 5070에서는 2x 권장."
            >
              <ToggleGroup
                options={[{ value: '1', label: '1x' }, { value: '2', label: '2x' }]}
                value={String(store.previewDpr)}
                onChange={(v) => set('previewDpr', Number(v) as AppSettings['previewDpr'])}
              />
            </SettingRow>

          </Section>

          {/* ── Render ───────────────────────────────────────────────────── */}
          <Section title="렌더링">

            <SettingRow
              label="NVENC 모드"
              description="Auto: NVENC 사용 가능 시 자동 선택. NVENC: RTX GPU 전용 하드웨어 인코더 강제 사용 (빠름, 낮은 CPU). CPU: libx264 소프트웨어 인코딩 (NVENC 오류 시 폴백)."
            >
              <ToggleGroup
                options={[
                  { value: 'auto', label: 'AUTO' },
                  { value: 'nvenc', label: 'NVENC' },
                  { value: 'cpu', label: 'CPU' },
                ]}
                value={store.nvencMode}
                onChange={(v) => set('nvencMode', v as AppSettings['nvencMode'])}
              />
            </SettingRow>

            <SettingRow
              label="FFmpeg 경로"
              description="시스템 PATH에 ffmpeg가 없을 경우 절대 경로를 입력합니다. 비워두면 PATH에서 자동으로 찾습니다. 예: C:\ffmpeg\bin\ffmpeg.exe"
            >
              <TextInput
                value={store.ffmpegPath}
                placeholder="(시스템 PATH 사용)"
                onChange={(v) => set('ffmpegPath', v)}
              />
            </SettingRow>

            <SettingRow
              label="출력 폴더"
              description="렌더 완료 후 백엔드가 영상을 저장하는 경로입니다. 비워두면 백엔드 실행 디렉터리의 render_tmp/ 폴더가 사용됩니다."
            >
              <TextInput
                value={store.renderOutputPath}
                placeholder="(기본: render_tmp/)"
                onChange={(v) => set('renderOutputPath', v)}
              />
            </SettingRow>

          </Section>

          {/* ── AI Models ────────────────────────────────────────────────── */}
          <Section title="AI 모델">

            <SettingRow
              label="Whisper 모델"
              description="STT(음성→가사) 정확도와 VRAM 사용량 트레이드오프입니다. large-v3: 최고 품질, ~3GB VRAM. base: 빠름, ~1GB. tiny: 즉시, ~200MB. RTX 5070(12GB)에서는 large-v3 권장."
            >
              <ToggleGroup
                options={[
                  { value: 'tiny', label: 'TINY' },
                  { value: 'base', label: 'BASE' },
                  { value: 'large-v3', label: 'LARGE-V3' },
                ]}
                value={store.whisperModel}
                onChange={(v) => set('whisperModel', v as AppSettings['whisperModel'])}
              />
            </SettingRow>


          </Section>

          {/* ── LLM (Ollama) ──────────────────────────────────────────── */}
          <Section title="LLM (Ollama)">

            <SettingRow
              label="Ollama 모델"
              description="PR 탭(프롬프트 생성) 및 오디오 분석에 사용할 Ollama 모델입니다. gemma3:4b 권장. 로컬에 설치된 모델명을 입력하세요."
            >
              <TextInput
                value={store.ollamaModel}
                placeholder="gemma3:4b"
                onChange={(v) => set('ollamaModel', v)}
              />
            </SettingRow>

            <SettingRow
              label="서버 상태"
              description="Ollama 서버 연결 상태를 확인합니다. 연결 실패 시 터미널에서 'ollama serve'를 실행하세요."
            >
              <OllamaHealthCheck />
            </SettingRow>

          </Section>


          {/* ── V2 placeholder ───────────────────────────────────────────── */}
          <Section title="V2 예정 기능">
            <div className="px-4 py-3 flex flex-col gap-1.5">
              {[
                '프로젝트 기본 템플릿 — 새 프로젝트 생성 시 VFX·타이틀 프리셋 자동 적용',
                '단축키 커스텀 — TAP 모드 키 재매핑 (현재: [ ] space)',
                '씬 타임라인 — 다중 씬 구간 편집',
                '플레이리스트 연속 렌더 — 전체 앨범 단일 영상 출력',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 opacity-40">
                  <span className="text-ink-300 text-[9px] mt-0.5 shrink-0">—</span>
                  <span className="text-[10px] text-ink-400">{item}</span>
                </div>
              ))}
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-cream-300 shrink-0">
          <button
            onClick={() => { store.reset(); }}
            className="text-[10px] label-caps text-ink-300 hover:text-ink-500 transition-colors"
          >
            기본값으로 초기화
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 label-caps text-[11px] bg-ink-900 text-cream-100
              border border-ink-900 hover:bg-ink-700 transition-colors"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Ollama health check ──────────────────────────────────────────────────────

function OllamaHealthCheck() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [model, setModel] = useState('');
  const backendUrl = useSettingsStore((s) => s.backendUrl);

  const check = useCallback(async () => {
    setStatus('checking');
    try {
      const base = backendUrl || '';
      const res = await fetch(`${base}/api/ollama/health`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (data.status === 'ok') {
        setStatus('ok');
        setModel(data.model || '');
      } else {
        setStatus('fail');
      }
    } catch {
      setStatus('fail');
    }
  }, [backendUrl]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={check}
        disabled={status === 'checking'}
        className={`px-2.5 py-1 text-[9px] label-caps border transition-colors ${
          status === 'checking'
            ? 'bg-cream-200 text-ink-300 border-cream-300 cursor-wait'
            : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
        }`}
      >
        {status === 'checking' ? '확인 중…' : '연결 테스트'}
      </button>
      {status === 'ok' && (
        <span className="text-[9px] text-green-600 font-medium">
          연결됨 {model && `(${model})`}
        </span>
      )}
      {status === 'fail' && (
        <span className="text-[9px] text-red-500 font-medium">연결 실패</span>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 py-2 bg-cream-200 border-b border-cream-300">
        <span className="label-caps text-ink-400 text-[9px]">{title}</span>
      </div>
      <div className="divide-y divide-cream-200">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-ink-700 font-medium shrink-0 w-24">{label}</span>
        <div className="flex items-center gap-1 flex-1 justify-end">{children}</div>
      </div>
      <p className="text-[9px] text-ink-300 leading-relaxed">{description}</p>
    </div>
  );
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-[9px] label-caps border transition-colors
            ${value === opt.value
              ? 'bg-ink-900 text-cream-100 border-ink-900'
              : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 min-w-0 bg-cream-100 border border-cream-300 text-ink-900
        text-[10px] px-2 py-1 outline-none placeholder:text-ink-300
        focus:border-ink-500 transition-colors"
    />
  );
}
