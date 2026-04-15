/**
 * Fire-and-forget helper — logs errors with a context prefix but does not
 * await. Used for side-effects that must not block the main request path
 * (analytics counters, notifications, etc.).
 *
 * CLAUDE.md rule: "fire-and-forget は reject handler 必須 —
 * `.then(() => {}, () => {})`". This helper canonicalizes that contract:
 * silent success, logged failure. Do not use for audit logs on serverless
 * — prefer `after()` from `next/server` for those so the runtime keeps
 * the request alive until they flush.
 */
export function fireAndForget(
  promise: Promise<unknown>,
  context: string,
): void {
  promise.then(
    () => {},
    (err: unknown) => {
      console.error(`[ff:${context}]`, err);
    },
  );
}
