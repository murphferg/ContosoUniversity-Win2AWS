import { ReactNode } from 'react';

export interface ConfirmDeleteProps {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function ConfirmDelete({
  title,
  children,
  onConfirm,
  onCancel,
  isDeleting = false,
}: ConfirmDeleteProps) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-description"
      style={{
        border: '1px solid #dc3545',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        maxWidth: '480px',
      }}
    >
      <h2 id="confirm-delete-title" style={{ color: '#dc3545', marginTop: 0 }}>
        {title}
      </h2>
      <div id="confirm-delete-description" style={{ marginBottom: '1.5rem' }}>
        {children}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          style={{
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
          }}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          style={{
            backgroundColor: '#6c757d',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
