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
          <Section title="General">

            <SettingRow
              label="Language"
              description="UI display language. Reload required after change."
            >
              <ToggleGroup
                options={[{ value: 'ko', label: 'KO' }, { value: 'en', label: 'EN' }]}
                value={store.language}
                onChange={(v) => set('language', v as AppSettings['language'])}
              />
            </SettingRow>

            <SettingRow
              label="Auto-save"
              description="How often to persist changes to browser localStorage. Select 'Off' to save only via the SAVE button."
            >
              <ToggleGroup
                options={[
                  { value: '30', label: '30s' },
                  { value: '60', label: '1m' },
                  { value: '0', label: 'OFF' },
                ]}
                value={String(store.autoSaveInterval)}
                onChange={(v) => set('autoSaveInterval', Number(v) as AppSettings['autoSaveInterval'])}
              />
            </SettingRow>

          </Section>

          {/* ── Preview ──────────────────────────────────────────────────── */}
          <Section title="Preview">

            <SettingRow
              label="Canvas Resolution"
              description="Internal render resolution of the Three.js scene. Lowering to 720p reduces GPU load during editing. Does not affect final render quality."
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
              label="Preview DPR"
              description="Device Pixel Ratio. 2x is sharper on retina displays but doubles VRAM usage. 2x recommended on RTX 5070."
            >
              <ToggleGroup
                options={[{ value: '1', label: '1x' }, { value: '2', label: '2x' }]}
                value={String(store.previewDpr)}
                onChange={(v) => set('previewDpr', Number(v) as AppSettings['previewDpr'])}
              />
            </SettingRow>

          </Section>

          {/* ── Render ───────────────────────────────────────────────────── */}
          <Section title="Render">

            <SettingRow
              label="NVENC Mode"
              description="Auto: use NVENC if available. NVENC: force RTX hardware encoder (fastest, low CPU). CPU: libx264 software encode (fallback when NVENC fails)."
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
              label="FFmpeg Path"
              description="Absolute path to ffmpeg if not on system PATH. Leave empty to auto-detect. Example: C:\ffmpeg\bin\ffmpeg.exe"
            >
              <TextInput
                value={store.ffmpegPath}
                placeholder="(using system PATH)"
                onChange={(v) => set('ffmpegPath', v)}
              />
            </SettingRow>

            <SettingRow
              label="Output Folder"
              description="Where the backend writes finished renders. Leaves empty to use render_tmp/ in the backend working directory."
            >
              <TextInput
                value={store.renderOutputPath}
                placeholder="(default: render_tmp/)"
                onChange={(v) => set('renderOutputPath', v)}
              />
            </SettingRow>

          </Section>

          {/* ── AI Models ────────────────────────────────────────────────── */}
          <Section title="AI Models">

            <SettingRow
              label="Whisper Model"
              description="STT (speech-to-lyrics) accuracy vs VRAM trade-off. large-v3: best quality, ~3GB VRAM. base: fast, ~1GB. tiny: instant, ~200MB. large-v3 recommended on RTX 5070 (12GB)."
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
              label="Ollama Model"
              description="Model used by the Prompt tab and audio analysis. gemma3:4b recommended. Enter a locally-installed model name."
            >
              <TextInput
                value={store.ollamaModel}
                placeholder="gemma3:4b"
                onChange={(v) => set('ollamaModel', v)}
              />
            </SettingRow>

            <SettingRow
              label="Server Status"
              description="Check Ollama server connection. If it fails, run 'ollama serve' in a terminal."
            >
              <OllamaHealthCheck />
            </SettingRow>

          </Section>


          {/* ── V2 placeholder ───────────────────────────────────────────── */}
          <Section title="Coming in V2">
            <div className="px-4 py-3 flex flex-col gap-1.5">
              {[
                'Project templates — auto-apply VFX/title presets on new project',
                'Custom shortcuts — remap TAP mode keys (currently: [ ] space)',
                'Scene timeline — multi-scene segment editing',
                'Continuous playlist render — full album as a single video',
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
            Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 label-caps text-[11px] bg-ink-900 text-cream-100
              border border-ink-900 hover:bg-ink-700 transition-colors"
          >
            CLOSE
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
        {status === 'checking' ? 'Checking…' : 'Test connection'}
      </button>
      {status === 'ok' && (
        <span className="text-[9px] text-green-600 font-medium">
          Connected {model && `(${model})`}
        </span>
      )}
      {status === 'fail' && (
        <span className="text-[9px] text-red-500 font-medium">Connection failed</span>
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
