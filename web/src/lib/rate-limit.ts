type Window = { count: number; resetAt: number };

export function createRateLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, Window>();

  return function allow(key: string, now: number = Date.now()): boolean {
    const current = windows.get(key);
    if (!current || current.resetAt <= now) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}
