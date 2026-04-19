/**
 * Transport & utility icons for CanvasBottomBar.
 * Split out so the bar component isn't diluted by SVG markup.
 */

export function PlayIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5.14v14l11-7-11-7z" /></svg>;
}

export function PauseIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>;
}

export function UploadIcon() {
  return (
    <svg className="w-3 h-3 text-ink-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V21" />
    </svg>
  );
}

export function PreviewIcon({ active }: { active: boolean }) {
  return active
    ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none"/></svg>
    : <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
