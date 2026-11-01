/** Error carrying the HTTP status and the server's `error` code. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`API request failed with ${status}: ${code}`);
    this.name = "ApiError";
  }
}

const API_BASE = "/api";

/** JSON fetch against the same-origin API; throws ApiError on non-2xx. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiError(0, `network: ${reason}`);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? `http_${response.status}`);
  }
  return (await response.json()) as T;
}

/** Shorthand for JSON request bodies. */
export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
