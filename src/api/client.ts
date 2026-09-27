/**
 * Fetch wrapper for the Mio Doctors API.
 * - Access token lives in memory only (not readable after a reload).
 * - Refresh token lives in sessionStorage (tab-scoped, cleared when the tab closes).
 * - A 401 triggers one shared refresh; concurrent requests wait for it.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api/v1';
const REFRESH_KEY = 'mio_admin_refresh';

export interface Meta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionEnd: (() => void) | null = null;

export const session = {
  set(tokens: { accessToken: string; refreshToken: string }) {
    accessToken = tokens.accessToken;
    try {
      sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    } catch {
      /* storage blocked: session lasts until reload */
    }
  },
  clear() {
    accessToken = null;
    try {
      sessionStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
  refreshToken(): string | null {
    try {
      return sessionStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  onEnd(cb: () => void) {
    onSessionEnd = cb;
  },
};

async function refresh(): Promise<boolean> {
  const token = session.refreshToken();
  if (!token) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    session.set(body.data.tokens);
    return true;
  } catch {
    return false;
  }
}

export function refreshOnce(): Promise<boolean> {
  refreshing ??= refresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function url(path: string, query?: Query) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function request<T>(
  method: string,
  path: string,
  opts: { query?: Query; body?: unknown; auth?: boolean; text?: string } = {},
  retried = false,
): Promise<{ data: T; meta?: Meta }> {
  const headers: Record<string, string> = {};
  if (opts.text !== undefined) headers['Content-Type'] = 'text/csv';
  else if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(url(path, opts.query), {
      method,
      headers,
      body: opts.text ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the API running?', 0, 'NETWORK');
  }

  if (res.status === 401 && opts.auth !== false && !retried) {
    if (await refreshOnce()) return request<T>(method, path, opts, true);
    session.clear();
    onSessionEnd?.();
  }
  if (res.status === 204) return { data: undefined as T };

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const err = body?.error ?? {};
    const fields: Record<string, string> = {};
    for (const d of err.details ?? []) if (d?.path) fields[d.path] = d.message;
    throw new ApiError(err.message ?? `Request failed (${res.status})`, res.status, err.code ?? 'UNKNOWN', fields);
  }
  return { data: body.data as T, meta: body.meta };
}

/** Downloads a file (e.g. an Excel export) with the admin's session and saves it. */
async function download(path: string, query: Query, fallbackName: string, retried = false): Promise<void> {
  const res = await fetch(url(path, query), { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }).catch(() => null);
  if (!res) throw new ApiError('Cannot reach the server. Is the API running?', 0, 'NETWORK');
  if (res.status === 401 && !retried && (await refreshOnce())) return download(path, query, fallbackName, true);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error?.message ?? `Download failed (${res.status})`, res.status, body?.error?.code ?? 'UNKNOWN');
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const href = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const api = {
  download,
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body: unknown = {}, auth = true) => request<T>('POST', path, { body, auth }),
  /** Raw CSV upload. */
  postCsv: <T>(path: string, text: string, query?: Query) => request<T>('POST', path, { text, query }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
