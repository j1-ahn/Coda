'use client';

import { useState, useEffect, useRef } from 'react';
import { useCodaStore, sanitizeForSave } from '@/store/useCodaStore';

const API = '';

interface ProjectMeta {
  project_id: string;
  name: string;
  saved_at: number;
}

function formatDate(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SaveLoadPanel() {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadOpen, setLoadOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!loadOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setLoadOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [loadOpen]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveStatus('saving');
    const state = useCodaStore.getState();
    const clean = sanitizeForSave(state);
    const name = `${state.titleText || 'Untitled'} ${new Date().toLocaleDateString('ko-KR')}`;
    try {
      const res = await fetch(`${API}/api/project/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: state.projectId,
          name,
          data: clean,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // ── Load list ──────────────────────────────────────────────────────────────
  const handleOpenLoad = async () => {
    setLoadOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/project/list`);
      const json = await res.json();
      setProjects(json.projects ?? []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Load project ──────────────────────────────────────────────────────────
  const handleLoad = async (pid: string) => {
    try {
      const res = await fetch(`${API}/api/project/load/${pid}`);
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      useCodaStore.setState(json.data, true);
      setLoadOpen(false);
    } catch {
      alert('프로젝트를 불러오는 데 실패했습니다.');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (pid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${API}/api/project/${pid}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.project_id !== pid));
  };

  const saveLabel =
    saveStatus === 'saving' ? '저장 중…'
    : saveStatus === 'saved'  ? '저장됨 ✓'
    : saveStatus === 'error'  ? '오류 ✕'
    : 'SAVE';

  return (
    <div className="relative flex items-center gap-1" ref={dropRef}>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saveStatus === 'saving'}
        className={`px-3 py-1.5 label-caps border transition-colors text-[11px] rounded-none
          ${saveStatus === 'saved'  ? 'bg-ink-900 text-cream-100 border-ink-900' :
            saveStatus === 'error'  ? 'border-red-400 text-red-500' :
            'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'}
          disabled:opacity-50`}
      >
        {saveLabel}
      </button>

      {/* Load button */}
      <button
        onClick={handleOpenLoad}
        className="px-3 py-1.5 label-caps border border-cream-300 text-ink-500
          hover:border-ink-500 hover:text-ink-900 transition-colors text-[11px] rounded-none"
      >
        LOAD
      </button>

      {/* Load dropdown */}
      {loadOpen && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-cream-100 border border-cream-300 shadow-lg z-50">
          <div className="px-3 py-2 border-b border-cream-300">
            <span className="label-caps text-ink-500">저장된 프로젝트</span>
          </div>

          {loading && (
            <div className="px-3 py-4 text-center label-caps text-ink-300 animate-pulse">불러오는 중…</div>
          )}

          {!loading && projects.length === 0 && (
            <div className="px-3 py-4 text-center label-caps text-ink-300">저장된 프로젝트 없음</div>
          )}

          {!loading && projects.map((p) => (
            <div
              key={p.project_id}
              onClick={() => handleLoad(p.project_id)}
              className="flex items-center justify-between px-3 py-2.5 hover:bg-cream-200 cursor-pointer border-b border-cream-200 group transition-colors"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs text-ink-900 truncate">{p.name}</span>
                <span className="text-[10px] text-ink-300">{formatDate(p.saved_at)}</span>
              </div>
              <button
                onClick={(e) => handleDelete(p.project_id, e)}
                className="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-ink-900 transition-all text-sm ml-2 shrink-0"
                title="삭제"
              >
                ×
              </button>
            </div>
          ))}

          <div className="px-3 py-2 text-[9px] text-ink-300 label-caps">
            * 미디어 파일(이미지·오디오)은 재업로드 필요
          </div>
        </div>
      )}

    </div>
  );
}
