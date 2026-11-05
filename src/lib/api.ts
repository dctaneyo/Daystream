export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message && message.length > 0 ? message : code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiOptions extends Omit<RequestInit, "body" | "headers"> {
  json?: unknown;
  headers?: Record<string, string>;
  body?: BodyInit | null;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Rotates the short-lived access token; the server enforces the 7-day wall. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;

  const send = () =>
    fetch(`/api${path}`, {
      credentials: "same-origin",
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : options.body,
    });

  let response = await send();
  const authPath = path.startsWith("/auth/");

  if (response.status === 401 && !authPath) {
    if (await refreshSession()) response = await send();
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    message?: unknown;
  };

  if (!response.ok) {
    if (response.status === 401 && !authPath) {
      window.dispatchEvent(new Event("daystream:session-expired"));
    }
    throw new ApiError(
      response.status,
      String(payload.error ?? "request_failed"),
      typeof payload.message === "string" ? payload.message : undefined,
    );
  }

  return payload as T;
}
