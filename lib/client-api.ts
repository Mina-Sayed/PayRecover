export interface ApiErrorResponse {
  error: string;
  code?: string;
}

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
