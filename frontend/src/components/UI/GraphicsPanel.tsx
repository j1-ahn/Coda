'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useCodaStore } from '@/store/useCodaStore';
import type { TransitionType } from '@/store/useCodaStore';

// ── 20가지 트랜지션 정의 ─────────────────────────────────────────────────────

interface TransitionDef {
  type: TransitionType;
  label: string;
  icon: string;
}

const TRANSITIONS: TransitionDef[] = [
  { type: 'cut',         label: 'CUT',      icon: '✂' },
  { type: 'fade',        label: 'FADE',     icon: '◐' },
  { type: 'dissolve',    label: 'DISSOLVE', icon: '⬡' },
  { type: 'white-flash', label: 'W.FLASH',  icon: '☀' },
  { type: 'black-flash', label: 'B.FLASH',  icon: '◉' },
  { type: 'wipe-left',   label: '←WIPE',    icon: '◁' },
  { type: 'wipe-right',  label: '→WIPE',    icon: '▷' },
  { type: 'wipe-up',     label: '↑WIPE',    icon: '△' },
  { type: 'wipe-down',   label: '↓WIPE',    icon: '▽' },
  { type: 'slide-left',  label: '←SLIDE',   icon: '◀' },
  { type: 'slide-right', label: '→SLIDE',   icon: '▶' },
  { type: 'slide-up',    label: '↑SLIDE',   icon: '▲' },
  { type: 'slide-down',  label: '↓SLIDE',   icon: '▼' },
  { type: 'zoom-in',     label: 'ZOOM IN',  icon: '⊕' },
  { type: 'zoom-out',    label: 'ZOOM OUT', icon: '⊖' },
  { type: 'blur',        label: 'BLUR',     icon: '◎' },
  { type: 'glitch',      label: 'GLITCH',   icon: '⚡' },
  { type: 'film-burn',   label: 'BURN',     icon: '◈' },
  { type: 'circle-wipe', label: 'CIRCLE',   icon: '○' },
  { type: 'spin',        label: 'SPIN',     icon: '↻' },
];

// ── Main Component ─────────────────────────────────────────────────────────

export default function GraphicsPanel() {
  const scenes               = useCodaStore((s) => s.scenes);
  const activeSceneId        = useCodaStore((s) => s.activeSceneId);
  const addScene             = useCodaStore((s) => s.addScene);
  const removeScene          = useCodaStore((s) => s.removeScene);
  const clearAllScenes       = useCodaStore((s) => s.clearAllScenes);
  const setActiveScene       = useCodaStore((s) => s.setActiveScene);
  const updateSceneBackground = useCodaStore((s) => s.updateSceneBackground);
  const updateSceneTransition = useCodaStore((s) => s.updateSceneTransition);
  const updateSceneDuration  = useCodaStore((s) => s.updateSceneDuration);
  const reorderScenes        = useCodaStore((s) => s.reorderScenes);

  const multiInputRef  = useRef<HTMLInputElement>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragSrcIdx,  setDragSrcIdx]  = useState<number | null>(null);
  const [scenePage,   setScenePage]   = useState(0);

  const SCENES_PER_PAGE = 5;

  const activeScene = scenes.find((s) => s.id === activeSceneId);

  // activeScene이 현재 페이지 밖에 있으면 해당 페이지로 자동 이동
  const activeSceneGlobalIdx = scenes.findIndex((s) => s.id === activeSceneId);
  const activePage = activeSceneGlobalIdx >= 0 ? Math.floor(activeSceneGlobalIdx / SCENES_PER_PAGE) : 0;
  const totalPages = Math.ceil(scenes.length / SCENES_PER_PAGE);
  // 현재 페이지가 유효 범위 초과 시 클램프
  const clampedPage = Math.min(scenePage, Math.max(0, totalPages - 1));
  const pageStart   = clampedPage * SCENES_PER_PAGE;
  const visibleScenes = scenes.slice(pageStart, pageStart + SCENES_PER_PAGE);

  // activeSceneId가 바뀔 때만 해당 페이지로 이동
  // (수동 페이지 전환은 건드리지 않음 — › ‹ 버튼이 덮어씌워지는 버그 방지)
  const prevActiveIdRef = useRef(activeSceneId);
  useEffect(() => {
    if (activeSceneId !== prevActiveIdRef.current) {
      prevActiveIdRef.current = activeSceneId;
      if (activeSceneGlobalIdx >= 0) {
        setScenePage(activePage);
      }
    }
  }, [activeSceneId, activeSceneGlobalIdx, activePage]);

  // ── 다중 이미지 업로드 ───────────────────────────────────────────────────
  const handleMultiFiles = useCallback(
    (files: FileList) => {
      const arr = Array.from(files).filter((f) =>
        f.type.startsWith('image/') || f.type.startsWith('video/')
      );
      if (arr.length === 0) return;

      // 첫 번째는 activeScene에, 나머지는 새 씬 추가
      arr.forEach((file, i) => {
        const url = URL.createObjectURL(file);
        const bg = {
          type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
          url,
          fileName: file.name,
        };
        if (i === 0 && activeSceneId) {
          updateSceneBackground(activeSceneId, bg);
        } else {
          // addScene 후 바로 배경 설정 (store에서 새 씬을 active로 만들어줌)
          addScene();
          const newId = useCodaStore.getState().activeSceneId!;
          updateSceneBackground(newId, bg);
        }
      });

      // 업로드 후 첫 씬으로 복귀
      if (activeSceneId) setActiveScene(activeSceneId);
    },
    [activeSceneId, updateSceneBackground, addScene, setActiveScene]
  );

  const handleMultiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleMultiFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleMultiFiles(e.dataTransfer.files);
  };

  // ── 단일 씬 배경 교체 ───────────────────────────────────────────────────
  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSceneId) return;
    updateSceneBackground(activeSceneId, {
      type: file.type.startsWith('video/') ? 'video' : 'image',
      url: URL.createObjectURL(file),
      fileName: file.name,
    });
    e.target.value = '';
  };

  // ── 씬 드래그 재정렬 ────────────────────────────────────────────────────
  const onDragStart = (idx: number) => setDragSrcIdx(idx);
  const onDragOver  = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === idx) {
      setDragOverIdx(null);
      setDragSrcIdx(null);
      return;
    }
    const ids = scenes.map((s) => s.id);
    const [moved] = ids.splice(dragSrcIdx, 1);
    ids.splice(idx, 0, moved);
    reorderScenes(ids);
    setDragOverIdx(null);
    setDragSrcIdx(null);
  };

  // ── 글로벌 트랜지션 적용 ────────────────────────────────────────────────
  const applyTransitionAll = (type: TransitionType) => {
    scenes.forEach((s) => {
      updateSceneTransition(s.id, {
        type,
        durationMs: s.transition?.durationMs ?? 800,
      });
    });
  };

  const selectedTransition = activeScene?.transition?.type ?? 'fade';
  const transitionDuration = activeScene?.transition?.durationMs ?? 800;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto divide-y divide-cream-300">

      {/* ── 1. 이미지 업로드 드롭존 ─────────────────────────────────────── */}
      <div className="p-3 shrink-0">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => multiInputRef.current?.click()}
          className="border-2 border-dashed border-cream-300 hover:border-ink-500 transition-colors
            cursor-pointer flex flex-col items-center justify-center gap-1 py-4 bg-cream-200/40"
        >
          <span className="text-ink-300 text-xl">+</span>
          <span className="label-caps text-[9px] text-ink-400">이미지/영상 여러 장 추가</span>
          <span className="text-[9px] text-ink-300">드래그 또는 클릭 · jpg png gif mp4</span>
        </div>
        <input
          ref={multiInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleMultiChange}
        />
      </div>

      {/* ── 2. 씬 썸네일 그리드 ─────────────────────────────────────────── */}
      <div className="p-2 shrink-0">
        {/* 헤더: 씬 수 + 페이지 네비 + 씬 추가 */}
        <div className="flex items-center justify-between px-1 mb-1.5">
          <span className="label-caps text-[9px] text-ink-400">씬 ({scenes.length})</span>

          <div className="flex items-center gap-1">
            {/* 페이지 ‹ › — 씬이 5개 초과일 때만 표시 */}
            {totalPages > 1 && (
              <>
                <button
                  onClick={() => {
                    const newPage = Math.max(0, clampedPage - 1);
                    setScenePage(newPage);
                    // 이전 페이지의 첫 씬을 활성화 → 캔버스 전환
                    const firstSceneOnPage = scenes[newPage * SCENES_PER_PAGE];
                    if (firstSceneOnPage) setActiveScene(firstSceneOnPage.id);
                  }}
                  disabled={clampedPage === 0}
                  className="w-4 h-4 flex items-center justify-center text-[9px] border border-cream-300
                    text-ink-400 hover:border-ink-500 hover:text-ink-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹
                </button>
                <span className="text-[8px] text-ink-300 tabular-nums">
                  {clampedPage + 1}/{totalPages}
                </span>
                <button
                  onClick={() => {
                    const newPage = Math.min(totalPages - 1, clampedPage + 1);
                    setScenePage(newPage);
                    // 다음 페이지의 첫 씬을 활성화 → 캔버스 전환
                    const firstSceneOnPage = scenes[newPage * SCENES_PER_PAGE];
                    if (firstSceneOnPage) setActiveScene(firstSceneOnPage.id);
                  }}
                  disabled={clampedPage === totalPages - 1}
                  className="w-4 h-4 flex items-center justify-center text-[9px] border border-cream-300
                    text-ink-400 hover:border-ink-500 hover:text-ink-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ›
                </button>
              </>
            )}
            <button
              onClick={() => {
                addScene();
                const newPage = Math.floor(scenes.length / SCENES_PER_PAGE);
                setScenePage(newPage);
              }}
              className="label-caps text-[9px] text-ink-400 hover:text-ink-900 transition-colors ml-1"
            >
              + 씬 추가
            </button>
            {/* 전체 삭제 */}
            <button
              onClick={() => {
                if (window.confirm(`씬 ${scenes.length}개를 모두 삭제하고 빈 씬 1개로 초기화합니다.`)) {
                  clearAllScenes();
                  setScenePage(0);
                }
              }}
              className="label-caps text-[9px] text-ink-300 hover:text-red-500 transition-colors ml-0.5"
              title="씬 전체 삭제"
            >
              전체삭제
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {visibleScenes.map((scene) => {
            const idx = scenes.indexOf(scene); // 전체 인덱스 (1-based 표시용)
            const isActive   = scene.id === activeSceneId;
            const isDragOver = dragOverIdx === idx;
            return (
              <div
                key={scene.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={(e) => onDrop(e, idx)}
                onDragLeave={() => setDragOverIdx(null)}
                onClick={() => setActiveScene(scene.id)}
                className={`flex items-center gap-2 px-2 py-1.5 border cursor-pointer transition-colors select-none
                  ${isActive ? 'border-ink-900 bg-ink-900/5' : 'border-cream-300 hover:border-ink-400'}
                  ${isDragOver ? 'border-t-2 border-t-ink-900' : ''}`}
              >
                {/* 썸네일 */}
                <div className="w-12 h-8 bg-cream-300 shrink-0 overflow-hidden">
                  {scene.background.url ? (
                    scene.background.type === 'video' ? (
                      <video
                        src={scene.background.url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={scene.background.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[8px] text-ink-300">없음</span>
                    </div>
                  )}
                </div>

                {/* 씬 정보 */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="label-caps text-[9px] text-ink-500 truncate">
                    {idx + 1}. {scene.background.fileName ?? '배경 없음'}
                  </span>
                  <span className="text-[8px] text-ink-300">
                    {scene.transition?.type ?? 'fade'} · {((scene.transition?.durationMs ?? 800) / 1000).toFixed(1)}s
                  </span>
                </div>

                {/* 교체 / 삭제 */}
                <div className="flex items-center gap-1 shrink-0">
                  {isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); singleInputRef.current?.click(); }}
                      className="w-5 h-5 flex items-center justify-center text-ink-400 hover:text-ink-900 transition-colors text-[9px] border border-cream-300 hover:border-ink-500"
                      title="배경 교체"
                    >
                      ↑
                    </button>
                  )}
                  {scenes.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeScene(scene.id); }}
                      className="w-5 h-5 flex items-center justify-center text-ink-300 hover:text-red-500 transition-colors text-sm leading-none"
                      title="씬 삭제"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <input
          ref={singleInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleSingleChange}
        />
      </div>

      {/* ── 3. 트랜지션 & 지속 시간 ────────────────────────────────────── */}
      <div className="p-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="label-caps text-[9px] text-ink-400">씬 전환 (20종)</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (!activeSceneId) return;
                updateSceneTransition(activeSceneId, { type: 'cut', durationMs: 0 });
              }}
              className="text-[8px] text-ink-300 hover:text-red-400 transition-colors"
              title="선택 씬 트랜지션 해제"
            >
              선택 해제
            </button>
            <span className="text-[8px] text-ink-200">·</span>
            <span className="text-[9px] text-ink-300">선택 씬에 적용</span>
          </div>
        </div>

        {/* 트랜지션 그리드 */}
        <div className="grid grid-cols-5 gap-0.5 mb-2">
          {TRANSITIONS.map((tr) => {
            const active = selectedTransition === tr.type;
            return (
              <button
                key={tr.type}
                onClick={() => {
                  if (!activeSceneId) return;
                  updateSceneTransition(activeSceneId, {
                    type: tr.type,
                    durationMs: transitionDuration,
                  });
                }}
                title={tr.label}
                className={`flex flex-col items-center justify-center py-1.5 gap-0.5 border transition-colors
                  ${active ? 'border-ink-900 bg-ink-900 text-cream-100' : 'border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900'}`}
              >
                <span className="text-[11px] leading-none">{tr.icon}</span>
                <span className="text-[7.5px] leading-none font-medium tracking-tight">{tr.label}</span>
              </button>
            );
          })}
        </div>

        {/* 지속 시간 슬라이더 */}
        <div className="flex items-center gap-2">
          <span className="label-caps text-[9px] text-ink-400 shrink-0 w-12">Duration</span>
          <input
            type="range"
            min={0}
            max={2000}
            step={100}
            value={transitionDuration}
            onChange={(e) => {
              if (!activeSceneId) return;
              updateSceneTransition(activeSceneId, {
                type: selectedTransition,
                durationMs: Number(e.target.value),
              });
            }}
            className="flex-1 accent-ink-900"
          />
          <span className="text-[9px] text-ink-500 w-8 text-right shrink-0">
            {(transitionDuration / 1000).toFixed(1)}s
          </span>
        </div>

        {/* 전체 씬 버튼 행 */}
        <div className="mt-2 flex gap-1">
          <button
            onClick={() => applyTransitionAll(selectedTransition)}
            className="flex-1 py-1 label-caps text-[9px] border border-cream-300 text-ink-400
              hover:border-ink-500 hover:text-ink-900 transition-colors"
          >
            전체 씬 동일 적용
          </button>
          <button
            onClick={() => scenes.forEach((s) => updateSceneTransition(s.id, { type: 'cut', durationMs: 0 }))}
            className="flex-1 py-1 label-caps text-[9px] border border-cream-300 text-ink-300
              hover:border-red-400 hover:text-red-400 transition-colors"
          >
            전체 씬 해제
          </button>
        </div>
      </div>

      {/* ── 4. 씬 재생 시간 ─────────────────────────────────────────────── */}
      {activeScene && (
        <div className="p-3 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="label-caps text-[9px] text-ink-400">씬 {(scenes.indexOf(activeScene) + 1)} 재생 시간</span>
            <span className="text-[9px] text-ink-500">{activeScene.durationSec}s</span>
          </div>
          <input
            type="range"
            min={1}
            max={60}
            step={1}
            value={activeScene.durationSec || 10}
            onChange={(e) => updateSceneDuration(activeSceneId!, Number(e.target.value))}
            className="w-full accent-ink-900"
          />
          <div className="flex justify-between text-[8px] text-ink-300 mt-0.5">
            <span>1s</span><span>30s</span><span>60s</span>
          </div>
        </div>
      )}

    </div>
  );
}
