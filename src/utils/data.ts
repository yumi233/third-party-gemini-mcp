export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

export class SafeError extends Error {}
export function safeMessage(error: unknown): string {
  return error instanceof SafeError ? error.message : 'Operation failed; provider and filesystem details suppressed.';
}
