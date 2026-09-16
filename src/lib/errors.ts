import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * A error that is safe to show the client.
 *
 * Anything thrown that is NOT an AppError is treated as unexpected: it gets
 * logged in full on the server and the client only sees a generic message.
 * Raw Prisma errors, stack traces and internal messages must never reach the
 * browser.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Successful API response body. */
export type ApiSuccess<T> = { data: T };

/** Failed API response body. */
export type ApiFailure = {
  error: { code: string; message: string; fields?: Record<string, string[]> };
};

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status });
}

export function apiFailure(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string[]>,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { error: fields ? { code, message, fields } : { code, message } },
    { status },
  );
}

/**
 * Converts anything thrown inside a route handler into a safe response.
 * Every API route wraps its body in try/catch and passes the error here.
 */
export function handleApiError(error: unknown, route: string): NextResponse<ApiFailure> {
  if (error instanceof ZodError) {
    // Field-level messages are safe: they describe the caller's own input.
    const fields = z4FieldErrors(error);
    return apiFailure("VALIDATION_ERROR", "Please check the highlighted fields.", 422, fields);
  }

  if (error instanceof AppError) {
    return apiFailure(error.code, error.message, error.statusCode);
  }

  // Unexpected. Log the real thing, tell the client nothing.
  console.error(`[${route}] Unhandled error:`, error);
  return apiFailure("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}

/** Zod 4 issue list -> { fieldName: [messages] }. */
function z4FieldErrors(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }

  return fields;
}
