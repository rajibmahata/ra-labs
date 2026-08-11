import { useState, ReactNode } from 'react';

interface InlineConfirmProps {
  onConfirm: () => void | Promise<void>;
  buttonLabel?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineConfirm({
  onConfirm,
  buttonLabel = 'Delete',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  className = 'btn btn--outline btn--sm',
  disabled = false,
}: InlineConfirmProps) {
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {buttonLabel}
      </button>
    );
  }

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      // The parent component typically re-renders or unmounts the row,
      // but we reset state safely here just in case.
      setAsking(false);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={loading}
        onClick={() => void handleConfirm()}
      >
        {loading ? '...' : confirmLabel}
      </button>
      <button
        type="button"
        className="btn btn--outline btn--sm"
        disabled={loading}
        onClick={() => setAsking(false)}
      >
        {cancelLabel}
      </button>
    </div>
  );
}