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

/** Dev: empty → same-origin + Vite proxy. Prod: empty when UI is served from the same host as `/api` (Docker/Railway); set `VITE_API_BASE_URL` only if the API lives on another origin. */
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

function messageFromJson(j: { message?: string | string[] }): string | null {
  if (Array.isArray(j.message)) {
    return j.message.join(', ');
  }
  if (typeof j.message === 'string') {
    return j.message;
  }
  return null;
}

async function readBodyText(res: Response): Promise<string> {
  return res.text();
}

async function parseError(res: Response, text: string): Promise<string> {
  if (!text.trim()) {
    return `שגיאה ${res.status} — אין תגובה מהשרת (האם ה-API רץ?)`;
  }
  try {
    const msg = messageFromJson(JSON.parse(text) as { message?: string | string[] });
    if (msg) {
      return msg;
    }
  } catch {
    /* ignore */
  }
  return text;
}

async function parseJsonBody<T>(res: Response, text: string): Promise<T> {
  if (!text.trim()) {
    throw new Error(
      `תגובה ריקה מהשרת (${res.status}). אם אתה בפיתוח מקומי, הרץ את ה-API: npm run start:dev`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`תגובה לא תקינה מהשרת (${res.status})`);
  }
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
  const text = await readBodyText(res);
  if (!res.ok) {
    throw new Error(await parseError(res, text));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return parseJsonBody<T>(res, text);
}
