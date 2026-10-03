export type SessionCredentials = { token: string; url: string };

const key = (sessionId: string) => `wafel:session:${sessionId}`;

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function storeCredentials(sessionId: string, credentials: SessionCredentials): void {
  storage()?.setItem(key(sessionId), JSON.stringify(credentials));
}

export function readCredentials(sessionId: string): SessionCredentials | null {
  const raw = storage()?.getItem(key(sessionId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { token, url } = value as Partial<SessionCredentials>;
    return typeof token === "string" && typeof url === "string" ? { token, url } : null;
  } catch {
    return null;
  }
}

export function clearCredentials(sessionId: string): void {
  storage()?.removeItem(key(sessionId));
}
