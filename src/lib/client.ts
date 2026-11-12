import { Beliq, BeliqApiError } from '@beliq/sdk';

/**
 * Zapier ends every action's perform at 30 seconds
 * (https://docs.zapier.com/platform/build/troubleshoot-action-timeouts). The
 * SDK's default budget of 15 minutes would always be cut there, with Zapier's
 * "did not respond in-time" in place of beliq's own error. With this budget no
 * retry starts later than 20 seconds after the SDK call's first attempt. The
 * budget bounds when an attempt starts, not how long it runs, and the perform's
 * file download before the call and file stash after it count toward Zapier's
 * 30 seconds too: an attempt still running then meets Zapier's cut.
 */
export const RETRY_BUDGET_MS = 20_000;

export interface BeliqAuthData {
  apiKey?: string;
}

/**
 * Build a configured beliq SDK client from the connected account. The SDK owns
 * the wire format (raw-body upload, content-type sniff, the `{success,data,error}`
 * envelope), so every create drives the same tested transport. An optional
 * `fetchImpl` lets tests inject a recording fetch in place of the global one.
 */
export function createClient(authData: BeliqAuthData, fetchImpl?: typeof fetch): Beliq {
  return new Beliq({
    apiKey: authData?.apiKey ?? '',
    fetch: fetchImpl,
    retryBudgetMs: RETRY_BUDGET_MS,
  });
}

/**
 * Turn an SDK error into a flat Error with a readable message. A BeliqApiError
 * carries the typed `{ code, message }` from beliq's error envelope; anything
 * else is surfaced verbatim.
 */
export function mapError(error: unknown): Error {
  if (error instanceof BeliqApiError) {
    return new Error(error.code ? `${error.message} (${error.code})` : error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** Coerce an object or JSON-string value into a non-empty plain object, or undefined. */
export function asJsonObject(value: unknown): Record<string, unknown> | undefined {
  let candidate: unknown = value;
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (trimmed === '') {
      return undefined;
    }
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const obj = candidate as Record<string, unknown>;
    return Object.keys(obj).length > 0 ? obj : undefined;
  }
  return undefined;
}
