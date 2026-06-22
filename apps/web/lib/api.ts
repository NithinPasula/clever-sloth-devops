import { API_URL } from "@/lib/config";
import { useAuthStore } from "@/store/auth";

/** ApiError carries the HTTP status so callers can branch on it. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? res.statusText, res.status);
  }
  return data as T;
}

interface Opts extends RequestInit {
  /** Attach the access token (default true). Set false for login/register. */
  auth?: boolean;
}

/**
 * api is the single fetch wrapper for the whole app. It injects the bearer
 * token and, on a 401, transparently refreshes the token once and retries —
 * so the UI never has to think about token expiry.
 */
export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const { auth = true, headers, ...rest } = opts;

  const doFetch = () => {
    const token = useAuthStore.getState().accessToken;
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  };

  let res = await doFetch();
  if (res.status === 401 && auth) {
    const refreshed = await useAuthStore.getState().refresh();
    if (refreshed) res = await doFetch();
  }
  return parse<T>(res);
}

export const apiGet = <T>(path: string) => api<T>(path, { method: "GET" });
export const apiPost = <T>(path: string, body?: unknown, opts: Opts = {}) =>
  api<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, ...opts });
export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });
