/**
 * Backend API client (Laravel + Sanctum, bearer tokens).
 *
 * In dev, Vite proxies /api to http://127.0.0.1:8000 (see vite.config.ts),
 * so no CORS setup is needed. Set VITE_API_URL to override the base path.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const TOKEN_KEY = 'mashahir_api_token';
const PENDING_KEY = 'mashahir_pending_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getPendingToken(): string | null {
  return localStorage.getItem(PENDING_KEY);
}

export function setPendingToken(token: string | null): void {
  if (token) {
    localStorage.setItem(PENDING_KEY, token);
  } else {
    localStorage.removeItem(PENDING_KEY);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** First validation error message (Persian, from the backend). */
  firstError(): string {
    const first = Object.values(this.errors)[0];
    return first?.[0] ?? this.message;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Which credential to send: the role token (default) or the pending one. */
  tokenKind?: 'role' | 'pending' | 'none';
}

export async function api<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, tokenKind = 'role' } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = tokenKind === 'role' ? getToken() : tokenKind === 'pending' ? getPendingToken() : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON response body
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message ?? `خطای ${response.status} در ارتباط با سرور`,
      payload?.errors ?? {},
    );
  }

  return payload as T;
}

/** Auth context payload from GET /v1/auth/context */
export interface AuthContextPayload {
  user: {
    ulid: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  school: { ulid: string; name: string } | null;
  active_role: {
    key: string;
    title: string;
    scope_type: string;
  } | null;
  permissions: { key: string; condition: string | null }[];
}

export interface RoleOption {
  id: number;
  role_key: string;
  role_title: string;
  scope_type: string;
  school_ulid: string;
  school_name: string;
}
