const SESSION_KEY = "bazaar_storefront_session";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface StoredSession {
  id: string;
  lastSeenAt: number;
}

// Mirrors typical web-analytics session semantics: the same id is reused
// for 30 minutes of activity, then a fresh one starts - that gap is what
// defines a "new visit" rather than a continuation of the last one.
export function getSessionId(): string {
  const now = Date.now();
  const raw = localStorage.getItem(SESSION_KEY);

  if (raw) {
    try {
      const stored = JSON.parse(raw) as StoredSession;
      if (now - stored.lastSeenAt < SESSION_TIMEOUT_MS) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id: stored.id, lastSeenAt: now }));
        return stored.id;
      }
    } catch {
      // fall through to generate a new session
    }
  }

  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeenAt: now }));
  return id;
}
