import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

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
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  className = 'btn btn--outline btn--sm',
  disabled = false,
}: InlineConfirmProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </button>
      <ConfirmDialog
        open={open}
        title={`${String(confirmLabel)}?`}
        description="This action cannot be undone."
        confirmLabel={String(confirmLabel)}
        cancelLabel={cancelLabel}
        danger={String(buttonLabel).toLowerCase().includes('delete') || String(confirmLabel).toLowerCase().includes('delete')}
        onConfirm={async () => {
          await onConfirm();
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
