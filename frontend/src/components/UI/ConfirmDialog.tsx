'use client';

/**
 * ConfirmDialog — 재사용 가능한 확인 모달.
 * 삭제 등 비가역 액션 전에 사용.
 */

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[#edeae3] border border-cream-300 shadow-lg w-72 p-5 flex flex-col gap-4">
        {title && (
          <span className="label-caps text-ink-700 text-[10px]">{title}</span>
        )}
        <p className="text-[11px] text-ink-900 leading-relaxed whitespace-pre-line">
          {message}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className={`flex-1 py-1.5 label-caps text-[10px] border transition-colors ${
              danger
                ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                : 'bg-ink-900 text-cream-100 border-ink-900 hover:bg-ink-700'
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 label-caps text-[10px] border border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900 transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
