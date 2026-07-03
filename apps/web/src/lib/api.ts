const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Thin fetch wrapper. `credentials: "include"` is required so the
 * HttpOnly admin session cookie set by /auth/login is sent on every
 * subsequent call — the token itself never touches browser JS.
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export function startIntegrationConnect(provider: "gmail" | "hubspot" | "slack"): void {
  window.location.href = `${API_BASE_URL}/auth/${provider}/start`;
}
