const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;

interface AuthRateLimitBucket {
  attempts: number;
  startedAt: number;
}

const globalForAuthRateLimit = globalThis as typeof globalThis & {
  authRateLimitStore?: Map<string, AuthRateLimitBucket>;
};

const authRateLimitStore =
  globalForAuthRateLimit.authRateLimitStore ?? new Map<string, AuthRateLimitBucket>();

if (!globalForAuthRateLimit.authRateLimitStore) {
  globalForAuthRateLimit.authRateLimitStore = authRateLimitStore;
}

function toRateLimitKey(email: string, ipAddress: string): string {
  return `${email.trim().toLowerCase()}|${ipAddress.trim().toLowerCase()}`;
}

function getBucket(email: string, ipAddress: string, now: number): AuthRateLimitBucket | null {
  const key = toRateLimitKey(email, ipAddress);
  const bucket = authRateLimitStore.get(key);

  if (!bucket) {
    return null;
  }

  if (now - bucket.startedAt >= AUTH_RATE_LIMIT_WINDOW_MS) {
    authRateLimitStore.delete(key);
    return null;
  }

  return bucket;
}

export function getRequestClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-client-ip') ||
    'unknown'
  );
}

export function isAuthRateLimited(
  email: string,
  ipAddress: string,
  now = Date.now()
): boolean {
  const bucket = getBucket(email, ipAddress, now);
  return bucket !== null && bucket.attempts >= AUTH_RATE_LIMIT_MAX_ATTEMPTS;
}

export function recordAuthFailure(
  email: string,
  ipAddress: string,
  now = Date.now()
): void {
  const key = toRateLimitKey(email, ipAddress);
  const bucket = getBucket(email, ipAddress, now);

  if (!bucket) {
    authRateLimitStore.set(key, {
      attempts: 1,
      startedAt: now,
    });
    return;
  }

  authRateLimitStore.set(key, {
    attempts: bucket.attempts + 1,
    startedAt: bucket.startedAt,
  });
}

export function clearAuthFailures(email: string, ipAddress: string): void {
  authRateLimitStore.delete(toRateLimitKey(email, ipAddress));
}

export function resetAuthRateLimitStore(): void {
  authRateLimitStore.clear();
}
