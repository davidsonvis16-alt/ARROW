import { isSupabaseConfigured } from '../lib/supabase';
import {
  clearDeviceIdentity,
  createIdentity,
  Identity,
  isEnvelope,
  loadDeviceIdentity,
  open,
  parseEnvelope,
  PublicJwk,
  rewrapIdentity,
  saveDeviceIdentity,
  seal,
  securityCode,
  unlockIdentity,
  WrappedKey,
} from '../lib/e2ee';
import { ArrowApiError, rpc, rpcSafe } from './rpc';

/**
 * Secure chat: the person's key, and sealing/opening content for one partner.
 *
 *   unavailable — no backend (demo mode) or no signed-in user
 *   needs-setup — this account has never set up secure chat
 *   locked      — set up, but this device needs the passcode once
 *   ready       — the key is unlocked on this device
 */
export type SecureStatus = 'unavailable' | 'needs-setup' | 'locked' | 'ready';

interface ServerKey {
  keyId: string;
  publicKey: PublicJwk;
  wrappedKey: WrappedKey;
  createdAt: string;
}

interface PartnerKey {
  keyId: string;
  publicKey: PublicJwk;
  current: boolean;
}

/** Thrown when something cannot be opened on this device. */
export class SealedError extends Error {
  constructor(message = 'This was encrypted to a key this device does not have.') {
    super(message);
    this.name = 'SealedError';
  }
}

export const MIN_PASSCODE = 8;

let userId: string | null = null;
let status: SecureStatus = 'unavailable';
let identity: Identity | null = null;
let serverKey: ServerKey | null = null;
const partnerKeys = new Map<string, Promise<PartnerKey[]>>();
const listeners = new Set<(s: SecureStatus) => void>();

function setStatus(next: SecureStatus) {
  status = next;
  listeners.forEach((fn) => fn(next));
}

function seenKey(partnerId: string): string {
  return `arrow_seen_key:${userId}:${partnerId}`;
}

function checkPasscode(passcode: string) {
  if (passcode.length < MIN_PASSCODE) {
    throw new Error(`Use at least ${MIN_PASSCODE} characters.`);
  }
}

async function keysFor(partnerId: string, refresh = false): Promise<PartnerKey[]> {
  if (refresh) partnerKeys.delete(partnerId);
  let pending = partnerKeys.get(partnerId);
  if (!pending) {
    pending = rpcSafe<PartnerKey[]>('arrow_get_public_keys', { p_user_id: partnerId }, []);
    partnerKeys.set(partnerId, pending);
  }
  return pending;
}

export const secureService = {
  get status() {
    return status;
  },

  subscribe(fn: (s: SecureStatus) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Work out where this account and device stand. Safe to call repeatedly. */
  async init(forUserId: string | null): Promise<SecureStatus> {
    if (!isSupabaseConfigured || !forUserId) {
      userId = null;
      identity = null;
      serverKey = null;
      setStatus('unavailable');
      return status;
    }

    if (userId !== forUserId) {
      partnerKeys.clear();
      identity = null;
    }
    userId = forUserId;

    serverKey = await rpcSafe<ServerKey | null>('arrow_get_my_key', {}, null);
    if (!serverKey) {
      identity = null;
      setStatus('needs-setup');
      return status;
    }

    const local = identity ?? (await loadDeviceIdentity(forUserId));
    if (local && local.keyId === serverKey.keyId) {
      identity = local;
      setStatus('ready');
    } else {
      // Reset from another device, or never unlocked here.
      identity = null;
      if (local) await clearDeviceIdentity(forUserId);
      setStatus('locked');
    }
    return status;
  },

  /** First-time setup, or a reset after a forgotten passcode. */
  async setup(passcode: string): Promise<void> {
    if (!userId) throw new Error('Log in first.');
    checkPasscode(passcode);
    const created = await createIdentity(passcode);
    serverKey = await rpc<ServerKey>('arrow_set_my_key', {
      p_key_id: created.identity.keyId,
      p_public_key: created.identity.publicKey,
      p_wrapped_key: created.wrapped,
    });
    identity = created.identity;
    await saveDeviceIdentity(userId, identity);
    setStatus('ready');
  },

  /** Unlock on this device with the passcode. */
  async unlock(passcode: string): Promise<void> {
    if (!userId || !serverKey) throw new Error('Secure chat is not set up yet.');
    identity = await unlockIdentity(serverKey.keyId, serverKey.publicKey, serverKey.wrappedKey, passcode);
    await saveDeviceIdentity(userId, identity);
    setStatus('ready');
  },

  async changePasscode(oldPasscode: string, newPasscode: string): Promise<void> {
    if (!serverKey) throw new Error('Secure chat is not set up yet.');
    checkPasscode(newPasscode);
    const wrapped = await rewrapIdentity(serverKey.wrappedKey, oldPasscode, newPasscode);
    serverKey = await rpc<ServerKey>('arrow_rewrap_my_key', { p_key_id: serverKey.keyId, p_wrapped_key: wrapped });
  },

  /** Forget the key on this device (log out). The account keeps it. */
  async forgetDevice(): Promise<void> {
    const id = userId;
    identity = null;
    serverKey = null;
    userId = null;
    partnerKeys.clear();
    await clearDeviceIdentity(id ?? undefined);
    setStatus('unavailable');
  },

  /** Encrypt text for one person. Retries once if their key just changed. */
  async sealFor(partnerId: string, text: string): Promise<string> {
    if (!identity) throw new SealedError('Unlock secure chat first.');
    for (const refresh of [false, true]) {
      const current = (await keysFor(partnerId, refresh)).find((k) => k.current);
      if (current) return seal(identity, current.keyId, current.publicKey, text);
    }
    throw new ArrowApiError('Secure chat starts once they next open Finderr.', '55000');
  },

  /**
   * Run a write with freshly sealed content, re-sealing once if the server
   * says the partner's key changed in the meantime.
   */
  async withSealed<T>(partnerId: string, text: string, write: (envelope: string) => Promise<T>): Promise<T> {
    try {
      return await write(await secureService.sealFor(partnerId, text));
    } catch (err) {
      if (err instanceof ArrowApiError && err.code === '22023' && /encrypted/i.test(err.message)) {
        await keysFor(partnerId, true);
        return write(await secureService.sealFor(partnerId, text));
      }
      throw err;
    }
  },

  /** Decrypt something exchanged with this partner, in either direction. */
  async openFrom(partnerId: string, value: string): Promise<string> {
    if (!isEnvelope(value)) return value;
    if (!identity) throw new SealedError('Unlock secure chat to read this.');

    const env = parseEnvelope(value);
    const mine = identity.keyId;
    if (env.senderKeyId !== mine && env.recipientKeyId !== mine) {
      throw new SealedError('Sent before your secure chat was reset.');
    }
    const theirId = env.senderKeyId === mine ? env.recipientKeyId : env.senderKeyId;

    let theirs = (await keysFor(partnerId)).find((k) => k.keyId === theirId);
    if (!theirs) theirs = (await keysFor(partnerId, true)).find((k) => k.keyId === theirId);
    if (!theirs) throw new SealedError();

    try {
      return await open(identity, env, theirs.keyId, theirs.publicKey);
    } catch {
      throw new SealedError('This message could not be verified.');
    }
  },

  /** JSON convenience over sealFor/openFrom. */
  async openJson<T>(partnerId: string, value: string | null | undefined): Promise<T | null> {
    if (!value) return null;
    return JSON.parse(await secureService.openFrom(partnerId, value)) as T;
  },

  /** The code two people can compare in person, or null if not available. */
  async securityCodeWith(partnerId: string): Promise<string | null> {
    if (!identity) return null;
    const current = (await keysFor(partnerId)).find((k) => k.current);
    return current ? securityCode(identity.publicKey, current.publicKey) : null;
  },

  /**
   * Whether this partner's key changed since you last looked (trust on first
   * use). The first sighting is remembered silently.
   */
  async partnerKeyChanged(partnerId: string): Promise<boolean> {
    const current = (await keysFor(partnerId)).find((k) => k.current);
    if (!current || !userId) return false;
    try {
      const seen = localStorage.getItem(seenKey(partnerId));
      if (!seen) {
        localStorage.setItem(seenKey(partnerId), current.keyId);
        return false;
      }
      return seen !== current.keyId;
    } catch {
      return false;
    }
  },

  acknowledgePartnerKey(partnerId: string): void {
    keysFor(partnerId).then((keys) => {
      const current = keys.find((k) => k.current);
      try {
        if (current && userId) localStorage.setItem(seenKey(partnerId), current.keyId);
      } catch {
        // Only costs a repeat of the notice.
      }
    });
  },
};
