/**
 * Thin client for our own API routes, which always answer with either
 * { data } or { error: { code, message, fields? } } (spec section 6).
 */

export type ApiErrorShape = {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again.",
      0,
    );
  }

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    // Fall through to the status-based error below.
  }

  if (!response.ok) {
    const error =
      isRecord(payload) && isRecord(payload.error) ? payload.error : null;

    throw new ApiError(
      typeof error?.code === "string" ? error.code : "UNKNOWN",
      typeof error?.message === "string"
        ? error.message
        : "Something went wrong. Please try again.",
      response.status,
      isRecord(error?.fields) ? (error.fields as Record<string, string[]>) : undefined,
    );
  }

  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
