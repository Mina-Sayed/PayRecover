import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

/**
 * Create an HTTP JSON error response with the provided message, status, and optional API error code.
 *
 * @param error - Human-readable error message to include in the response body
 * @param status - HTTP status code to set on the response
 * @param code - Optional machine-readable error code (see `ApiErrorCode`)
 * @returns A NextResponse whose JSON body contains `error` and, if provided, `code`, and that uses the supplied HTTP status
 */
export function apiError(error: string, status: number, code?: ApiErrorCode) {
  return NextResponse.json({ error, code }, { status });
}

/**
 * Parse and return the request body as JSON typed to `T`.
 *
 * @param request - The incoming `Request` whose body will be parsed as JSON.
 * @returns The parsed body as `T`, or `null` if the body cannot be parsed as valid JSON.
 */
export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
