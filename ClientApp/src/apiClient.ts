/**
 * Centralized API client with fetch wrapper, error handling, and JSON parsing.
 */

export class ApiError extends Error {
  public readonly status: number;
  public readonly errors: Record<string, string[]> | null;

  constructor(status: number, message: string, errors: Record<string, string[]> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  const isJson = contentType.includes('application/json');

  if (response.ok) {
    if (isJson) {
      return response.json() as Promise<T>;
    }
    return undefined as T;
  }

  // Non-2xx response — build an ApiError
  let errorMessage = `API error: ${response.status}`;
  let errors: Record<string, string[]> | null = null;

  if (isJson) {
    const body: unknown = await response.json().catch(() => null);

    if (body && typeof body === 'object') {
      // Validation error format: { "field": ["error1", ...] } or { errors: { ... } }
      if ('errors' in body && typeof (body as Record<string, unknown>).errors === 'object') {
        errors = (body as { errors: Record<string, string[]> }).errors;
      } else if (response.status === 400 && !('error' in body) && !('message' in body)) {
        // Direct dictionary format used by ASP.NET validation
        errors = body as Record<string, string[]>;
      }

      if ('error' in body && typeof (body as Record<string, unknown>).error === 'string') {
        errorMessage = (body as { error: string }).error;
      } else if ('message' in body && typeof (body as Record<string, unknown>).message === 'string') {
        errorMessage = (body as { message: string }).message;
      }
    }
  }

  throw new ApiError(response.status, errorMessage, errors);
}

function buildUrl(path: string, params?: Record<string, string | number | null | undefined>): string {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function get<T>(
  path: string,
  params?: Record<string, string | number | null | undefined>,
): Promise<T> {
  const url = buildUrl(path, params);
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  return handleResponse<T>(response);
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: formData,
  });
  return handleResponse<T>(response);
}

export async function put<T>(path: string, body?: unknown): Promise<T> {
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function putFormData<T>(path: string, formData: FormData): Promise<T> {
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Accept': 'application/json' },
    body: formData,
  });
  return handleResponse<T>(response);
}

export async function del<T = void>(path: string): Promise<T> {
  const url = buildUrl(path);
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' },
  });
  return handleResponse<T>(response);
}
