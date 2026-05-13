const TOKEN_KEY = 'medflow_token';

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

/** Dev: empty → same-origin + Vite proxy. Prod: set `VITE_API_BASE_URL` to API origin (e.g. `https://medflow-api.up.railway.app`). */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/$/,
  '',
) ?? '';

function apiUrl(path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  return `${API_BASE}${path}`;
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(j.message)) {
      return j.message.join(', ');
    }
    if (typeof j.message === 'string') {
      return j.message;
    }
  } catch {
    /* ignore */
  }
  return text || `שגיאה ${res.status}`;
}

/** Relative `/api` works with Vite dev proxy to Nest (port 3000). */
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(path), { ...options, headers });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
