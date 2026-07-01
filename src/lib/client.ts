import { Beliq, BeliqApiError } from '@beliq/sdk';

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
