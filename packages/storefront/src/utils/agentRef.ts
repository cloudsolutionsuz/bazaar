const AGENT_REF_KEY = "bazaar_storefront_agent_ref";
const AGENT_REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_REF_LENGTH = 64;

interface StoredAgentRef {
  code: string;
  savedAt: number;
}

// An agent's link is "<shop>/?ref=CODE". The code is remembered for 30 days
// so an order placed on a later visit still counts for that agent; opening
// another agent's link replaces it (last click wins).
export function captureAgentRef(search: string): void {
  const code = new URLSearchParams(search).get("ref")?.trim();
  if (!code) return;
  try {
    const stored: StoredAgentRef = { code: code.slice(0, MAX_REF_LENGTH), savedAt: Date.now() };
    localStorage.setItem(AGENT_REF_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable (private mode / quota) - the sale just goes unattributed.
  }
}

export function getAgentRef(): string | undefined {
  try {
    const raw = localStorage.getItem(AGENT_REF_KEY);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as Partial<StoredAgentRef>;
    if (typeof stored.code !== "string" || typeof stored.savedAt !== "number") return undefined;
    if (Date.now() - stored.savedAt > AGENT_REF_TTL_MS) {
      localStorage.removeItem(AGENT_REF_KEY);
      return undefined;
    }
    return stored.code;
  } catch {
    return undefined;
  }
}
