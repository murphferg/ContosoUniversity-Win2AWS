import { ApiError } from '../apiClient';

export interface ErrorMessageProps {
  message?: string;
  error?: ApiError | null;
}

export function ErrorMessage({ message, error }: ErrorMessageProps) {
  const displayMessage = message ?? error?.message ?? 'An unexpected error occurred.';

  if (!message && !error) {
    return null;
  }

  return (
    <div
      role="alert"
      style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#f8d7da',
        color: '#842029',
        border: '1px solid #f5c2c7',
        borderRadius: '0.25rem',
        marginBottom: '1rem',
      }}
    >
      {displayMessage}
    </div>
  );
}
