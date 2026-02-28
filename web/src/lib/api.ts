// VITE_API_BASE debe configurarse en producción y en builds móviles (Capacitor).
// El fallback a window.location no funciona en Capacitor (protocolo file://).
export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000";

export function getToken(): string | null {
  return localStorage.getItem('access_token');
}

export function setToken(token: string) {
  localStorage.setItem('access_token', token);
}

export function clearToken() {
  localStorage.removeItem('access_token');
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
