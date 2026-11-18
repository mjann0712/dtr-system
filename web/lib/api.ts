const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "") + "/api";
const TOKEN_KEY = "dtr-token";

export class ApiError extends Error {
  status: number; data: unknown;
  constructor(status: number, message: string, data: unknown) { super(message); this.status = status; this.data = data; }
}

export const getToken = () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY));
export const setToken = (t: string | null) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); };

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.body); }
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: opts.method || (body ? "POST" : "GET"), headers, body });
  } catch {
    throw new ApiError(0, "The DTR server could not be reached. Check that the API is running.", null);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== "/login") {
      setToken(null);
      if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) location.href = "/login";
    }
    const d = data as { message?: string; errors?: Record<string, string[]> } | null;
    const first = d?.errors ? Object.values(d.errors)[0]?.[0] : undefined;
    throw new ApiError(res.status, first || d?.message || `Request failed (${res.status})`, data);
  }
  return data as T;
}
