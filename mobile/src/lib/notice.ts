// Tiny app-wide notice channel. A module-level emitter so non-React code (the v1
// API client) can surface a brief, non-blocking message that NoticeHost renders as
// a dismissible top banner — never a modal, never overlapping bottom content.
type Listener = (message: string) => void;

let listener: Listener | null = null;
const lastShownAt: Record<string, number> = {};
const COOLDOWN_MS = 15000; // coalesce the same message (e.g. a polling read that keeps failing)

export function subscribeNotice(l: Listener): () => void {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
}

export function notify(message: string): void {
  const now = Date.now();
  if (now - (lastShownAt[message] ?? 0) < COOLDOWN_MS) return;
  lastShownAt[message] = now;
  listener?.(message);
}
