import { useCallback, useEffect, useState } from 'react';
import { ApiError, get } from '../apiClient';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

/**
 * Custom hook for GET data fetching with loading/error state management.
 *
 * @param path - The API path to fetch from (e.g. "/api/students")
 * @param params - Optional query parameters
 * @param deps - Additional dependencies that trigger a refetch when changed
 */
export function useApi<T>(
  path: string | null,
  params?: Record<string, string | number | null | undefined>,
  deps: unknown[] = [],
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [error, setError] = useState<ApiError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // Serialize params for stable dependency comparison
  const paramsKey = params ? JSON.stringify(params) : '';

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (path === null) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    get<T>(path, params)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err : new ApiError(0, String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey, fetchCount, ...deps]);

  return { data, loading, error, refetch };
}
