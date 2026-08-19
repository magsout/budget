/**
 * Route a terminal write failure to the shared error banner. Offline writes never
 * reject — Firestore queues them — so this fires only on genuine errors.
 *
 * Shared rather than per-screen: a failed write is the same event to the reader
 * whichever form produced it, and two wordings for it would read as two bugs.
 */
export function syncErrorMessage(context: string, err: unknown): string {
  return `Échec de synchronisation (${context}) : ${err instanceof Error ? err.message : String(err)}`;
}
