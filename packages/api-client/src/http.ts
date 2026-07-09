export interface ApiErrorBody {
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string[]>;
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export interface RequestOptions {
  baseUrl?: string;
  accessToken?: string;
  init?: RequestInit;
}

const DEFAULT_BASE = 'http://localhost:3000/api/v1';

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const baseUrl =
    opts.baseUrl ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined) ??
    DEFAULT_BASE;

  const headers = new Headers(opts.init?.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  if (opts.accessToken) headers.set('authorization', `Bearer ${opts.accessToken}`);

  const res = await fetch(`${baseUrl}${path}`, {
    ...opts.init,
    headers,
    credentials: 'include',
  });

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const b = (body ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, b.message ?? res.statusText, b.errors);
  }
  return body as T;
}

// Shared query-string builder for list endpoints: serializes defined params,
// skips undefined/null, returns "" or "?a=1&b=2".
export function toQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
