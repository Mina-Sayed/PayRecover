export interface ApiErrorResponse {
  error: string;
  code?: string;
}

/**
 * Perform an HTTP request and return the parsed JSON response typed as `T`.
 *
 * Sends a request with `Content-Type: application/json` (merging any provided headers), attempts to parse the response body as JSON (falls back to an empty object on parse failure), and returns the parsed payload when the response is successful.
 *
 * @param input - The resource that you wish to fetch (URL or RequestInfo)
 * @param init - Optional fetch init options; provided headers are merged over the default JSON header
 * @returns The parsed response payload typed as `T`
 * @throws Error - when the response has a non-OK status; message is the `error` field from the response payload if present, otherwise `"Request failed"`
 */
export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = payload as Partial<ApiErrorResponse>;
    throw new Error(err.error || 'Request failed');
  }

  return payload as T;
}
