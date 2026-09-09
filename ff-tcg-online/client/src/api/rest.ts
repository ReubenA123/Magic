// ============================================================================
// api/rest.ts
//
// The account system's HTTP surface (auth/decks/friends) - separate from
// api/socket.ts's live game connection, but pointed at the same server and
// the same VITE_SERVER_URL override.
//
// The session token lives in localStorage (not a cookie) precisely so this
// works with a plain `fetch` and a static CORS origin allowlist on the
// server, with no cross-origin cookie/credentials configuration to get
// right between the Vite dev server and the API.
// ============================================================================

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const TOKEN_STORAGE_KEY = 'magic-auth-token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage unavailable (private browsing, quota) - the session just
    // won't survive a refresh this time, same trade-off as elsewhere in the app.
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Every account-system call goes through here - attaches the bearer token
 * when one's on hand, and turns a non-2xx response into a thrown ApiError
 * carrying the server's own error message, so callers can just try/catch
 * and show result.message instead of re-parsing the response shape every time. */
async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${SERVER_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status}).`, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ?? {} }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
