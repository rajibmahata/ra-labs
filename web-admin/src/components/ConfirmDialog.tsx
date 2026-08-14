import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      (triggerRef.current as HTMLElement | null)?.focus();
      triggerRef.current = null;
      setLoading(false);
      return;
    }
    triggerRef.current = document.activeElement;
    requestAnimationFrame(() => confirmBtnRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', trap);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('keydown', trap);
      document.removeEventListener('keydown', esc);
    };
  }, [open, onCancel]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="confirm-dialog-scrim" onClick={onCancel} aria-hidden="true">
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-desc' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h2>
        {description && <p id="confirm-dialog-desc" className="confirm-dialog-desc">{description}</p>}
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => void handleConfirm()}
            disabled={loading}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
