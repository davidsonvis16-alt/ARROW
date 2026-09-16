import { getSupabase } from '../lib/supabase';

/**
 * Every server call goes through here.
 *
 * Note what these helpers do NOT accept: a user id. The database derives the
 * actor from the session's `auth.uid()`, so there is no "who am I" parameter
 * for a caller to tamper with. Adding one back would reintroduce the IDOR the
 * schema was built to remove.
 */

/** Postgres SQLSTATEs the schema raises deliberately, mapped to plain English. */
const FRIENDLY_ERRORS: Record<string, string> = {
  '28000': 'Please log in to continue.',
  '42501': 'That is not available to you.',
  '53400': 'You have hit a limit. Try again a little later.',
  '22023': 'That value was not accepted.',
};

export class ArrowApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ArrowApiError';
    this.code = code;
  }
}

function toApiError(error: { message?: string; code?: string; hint?: string }): ArrowApiError {
  const raw = (error.message || '').trim();

  // Messages raised by our own RAISE EXCEPTION calls are already written for
  // users, so prefer them over the generic mapping.
  const isOurs = raw && !raw.startsWith('permission denied') && !/function .* does not exist/.test(raw);
  const friendly = (error.code && FRIENDLY_ERRORS[error.code]) || 'Something went wrong. Please try again.';

  return new ArrowApiError(isOurs ? raw : friendly, error.code);
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);

  if (error) {
    throw toApiError(error);
  }

  return data as T;
}

/**
 * For calls where a failure should degrade quietly rather than break a screen —
 * a background refresh, an activity heartbeat.
 */
export async function rpcSafe<T>(fn: string, args: Record<string, unknown> = {}, fallback: T): Promise<T> {
  try {
    const result = await rpc<T>(fn, args);
    return (result ?? fallback) as T;
  } catch (err) {
    console.warn(`[arrow] ${fn} failed`, err);
    return fallback;
  }
}
