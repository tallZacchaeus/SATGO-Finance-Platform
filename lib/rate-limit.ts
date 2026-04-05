// In-memory rate limiter.
// NOTE: This resets per serverless instance. For multi-instance deployments
// (Vercel, etc.) add a Redis/KV-backed store once traffic warrants it.

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * @param key     Unique identifier (e.g. IP + route)
 * @param limit   Max requests per window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

/** Derive a stable key from an incoming Request (falls back to 'unknown'). */
export function getIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
