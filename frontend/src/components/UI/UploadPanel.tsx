'use client';

import { useRef, useState, useCallback } from 'react';
import { useCodaStore, AudioTrack } from '@/store/useCodaStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function loadAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio(url);
    a.addEventListener('loadedmetadata', () => resolve(a.duration));
    a.addEventListener('error', () => resolve(0));
  });
}

// ---------------------------------------------------------------------------
// Processing badge
// ---------------------------------------------------------------------------

function ProcessingBadge({ status }: { status: AudioTrack['processing'] }) {
  if (status === 'idle') {
    return <span className="text-[10px] px-2 py-0.5 bg-cream-300 text-ink-500 font-medium">대기</span>;
  }
  if (status === 'uploading') {
    return (
      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-ink-900 text-cream-100 font-medium">
        <SpinnerIcon /> 업로드 중...
      </span>
    );
  }
  if (status === 'transcribing') {
    return (
      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-ink-900 text-cream-100 font-medium">
        <SpinnerIcon /> 분석 중...
      </span>
    );
  }
  if (status === 'done') {
    return <span className="text-[10px] px-2 py-0.5 bg-ink-700 text-cream-100 font-medium">완료</span>;
  }
  return <span className="text-[10px] px-2 py-0.5 border border-red-800 text-red-800 font-medium">오류</span>;
}

function SpinnerIcon() {
  return (
    <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function UploadPanel({ mode = 'all' }: { mode?: 'all' | 'background' | 'audio' }) {
  const {
    projectId,
    scenes,
    activeSceneId,
    audioTracks,
    activeAudioTrackId,
    updateSceneBackground,
    addAudioTrack,
    removeAudioTrack,
    setAudioTrackProcessing,
    setWhisperSegments,
    setActiveAudioTrack,
  } = useCodaStore();

  const uploadToBackend = useCallback(
    async (kind: 'background' | 'audio', file: File) => {
      try {
        const form = new FormData();
        form.append('project_id', projectId);
        form.append(kind === 'background' ? 'background' : 'audio', file, file.name);
        await fetch('/api/export/upload', { method: 'POST', body: form });
      } catch {
        // ignore — backend may not be running
      }
    },
    [projectId]
  );

  const activeScene = scenes.find((s) => s.id === activeSceneId);
  const bgPreview = activeScene?.background.url ?? null;

  const [bgDragOver, setBgDragOver] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Background
  const applyBackground = useCallback(
    (file: File) => {
      if (!activeSceneId) return;
      const url = URL.createObjectURL(file);
      updateSceneBackground(activeSceneId, {
        type: file.type.startsWith('video') ? 'video' : 'image',
        url,
        fileName: file.name,
      });
      uploadToBackend('background', file);
    },
    [activeSceneId, updateSceneBackground, uploadToBackend]
  );

  const handleBgDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setBgDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) applyBackground(file);
  };

  const handleBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyBackground(file);
    e.target.value = '';
  };

  // Audio
  const handleAudioFiles = useCallback(
    async (files: FileList) => {
      const remaining = 50 - audioTracks.length;
      const toAdd = Array.from(files).slice(0, remaining);
      for (const file of toAdd) {
        const url = URL.createObjectURL(file);
        const id = addAudioTrack(file.name, url);
        const dur = await loadAudioDuration(url);
        useCodaStore.getState().setWhisperSegments(id, [], dur);
        useCodaStore.getState().setAudioTrackProcessing(id, 'idle');
        uploadToBackend('audio', file);
      }
    },
    [audioTracks.length, addAudioTrack, uploadToBackend]
  );

  const handleAudioDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) await handleAudioFiles(e.dataTransfer.files);
  };

  const handleAudioInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) await handleAudioFiles(e.target.files);
    e.target.value = '';
  };

  const handleTranscribe = async (track: AudioTrack) => {
    if (!track.url) return;
    setAudioTrackProcessing(track.id, 'transcribing');
    try {
      const blob = await fetch(track.url).then((r) => r.blob());
      const form = new FormData();
      form.append('file', blob, track.fileName);
      const res = await fetch('/api/whisper/transcribe', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWhisperSegments(track.id, data.segments ?? [], data.duration ?? track.durationSec);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setAudioTrackProcessing(track.id, 'error', msg);
    }
  };

  // Sections
  const showBackground = mode !== 'audio';
  const showAudio = mode !== 'background';

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      {showBackground && (
        <div>
          <SectionLabel>배경 이미지</SectionLabel>
          <div
            onDragOver={(e) => { e.preventDefault(); setBgDragOver(true); }}
            onDragLeave={() => setBgDragOver(false)}
            onDrop={handleBgDrop}
            onClick={() => bgInputRef.current?.click()}
            className={[
              'relative flex flex-col items-center justify-center',
              'border border-dashed cursor-pointer',
              'transition-all duration-200 select-none h-[90px]',
              bgDragOver
                ? 'border-ink-500 bg-cream-200'
                : 'border-cream-300 bg-cream-50 hover:bg-cream-200',
            ].join(' ')}
          >
            {bgPreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bgPreview} alt="bg preview" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <span className="text-[10px] bg-cream-100/80 px-2 py-0.5 text-ink-700">
                    {activeScene?.background.fileName ?? '이미지'}
                  </span>
                  <span className="text-[9px] text-ink-500">클릭하여 교체</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                <UploadIcon className="w-5 h-5 text-ink-300" />
                <span className="label-caps text-ink-500">드래그 앤 드롭 또는 클릭</span>
                <span className="text-[10px] text-ink-300">PNG · JPG · WEBP · MP4</span>
              </div>
            )}
          </div>
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleBgFileChange}
          />
        </div>
      )}

      {showBackground && showAudio && <div className="border-t border-cream-300" />}

      {showAudio && (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between">
            <SectionLabel>오디오 트랙</SectionLabel>
            <span className="text-[10px] text-ink-300">{audioTracks.length}/50</span>
          </div>

          {audioTracks.length < 50 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleAudioDrop}
              onClick={() => audioInputRef.current?.click()}
              className="flex items-center justify-center gap-2 h-8 border border-dashed border-cream-300 bg-cream-50 hover:bg-cream-200 cursor-pointer transition-colors"
            >
              <UploadIcon className="w-3.5 h-3.5 text-ink-300" />
              <span className="label-caps text-ink-500">오디오 추가 (MP3 · WAV · M4A)</span>
            </div>
          )}

          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleAudioInputChange}
          />

          <div className="flex flex-col gap-1.5 overflow-y-auto">
            {audioTracks.length === 0 && (
              <p className="text-center label-caps text-ink-300 py-3">오디오 트랙이 없습니다</p>
            )}
            {audioTracks.map((track) => (
              <AudioTrackCard
                key={track.id}
                track={track}
                isActive={track.id === activeAudioTrackId}
                onSelect={() => setActiveAudioTrack(track.id)}
                onRemove={() => removeAudioTrack(track.id)}
                onTranscribe={() => handleTranscribe(track)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AudioTrackCard
// ---------------------------------------------------------------------------

interface AudioTrackCardProps {
  track: AudioTrack;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onTranscribe: () => void;
}

function AudioTrackCard({ track, isActive, onSelect, onRemove, onTranscribe }: AudioTrackCardProps) {
  const canTranscribe = track.processing === 'idle' || track.processing === 'error';
  return (
    <div
      onClick={onSelect}
      className={[
        'flex items-center gap-2 p-2 border cursor-pointer transition-colors',
        isActive ? 'border-ink-500 bg-cream-200' : 'border-cream-300 bg-cream-50 hover:border-ink-300',
      ].join(' ')}
    >
      <div className="shrink-0 w-6 h-6 bg-cream-300 flex items-center justify-center">
        <AudioIcon className="w-3 h-3 text-ink-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-ink-900 truncate leading-tight">{track.fileName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-ink-300">{formatDuration(track.durationSec)}</span>
          <ProcessingBadge status={track.processing} />
          {track.error && (
            <span className="text-[10px] text-red-800 truncate max-w-[80px]" title={track.error}>
              {track.error}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onTranscribe}
          disabled={!canTranscribe}
          className={[
            'bg-ink-900 text-cream-100 rounded-none px-3 py-1 text-[10px] uppercase tracking-wider transition-colors',
            canTranscribe ? 'opacity-100 hover:bg-ink-700' : 'opacity-30 cursor-not-allowed',
          ].join(' ')}
        >
          자막 분석
        </button>
        <button
          onClick={onRemove}
          className="w-5 h-5 flex items-center justify-center text-ink-300 hover:text-ink-900 transition-colors"
        >
          x
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared icons
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-caps mb-2">{children}</p>;
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function AudioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
    </svg>
  );
}
