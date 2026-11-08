/**
 * End-to-end encryption primitives, on the browser's own WebCrypto.
 *
 * Each person has one ECDH P-256 key pair. Two people derive the same AES-256
 * key from their own private key and the other's public key (ECDH → HKDF), so
 * a message encrypted on one phone opens only on the other. The server stores
 * and relays envelopes it cannot open:
 *
 *   e2e1.<sender key id>.<recipient key id>.<iv>.<ciphertext>
 *
 * The header (version and both key ids) is bound into AES-GCM as additional
 * data, so a server swapping key ids around makes decryption fail rather than
 * silently pointing a message at someone else.
 *
 * The private key leaves the device only wrapped: AES-GCM under a key derived
 * from the person's passcode with PBKDF2-SHA-256. The passcode itself is never
 * sent anywhere.
 */

export const ENVELOPE_PREFIX = 'e2e1';
export const PBKDF2_ITERATIONS = 600_000;
const HKDF_INFO = 'arrow-e2e-v1';

export interface PublicJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
}

export interface WrappedKey {
  salt: string;
  iv: string;
  ct: string;
  iter: number;
}

export interface Identity {
  keyId: string;
  publicKey: PublicJwk;
  /** Non-extractable once stored: usable for ECDH, impossible to read out. */
  privateKey: CryptoKey;
}

const subtle = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure chat needs a modern browser over HTTPS.');
  }
  return globalThis.crypto.subtle;
};

// ------------------------------------------------------------------ encoding
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function toB64Url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();

// ------------------------------------------------------------------- identity
async function importPrivate(pkcs8: ArrayBuffer): Promise<CryptoKey> {
  return subtle().importKey('pkcs8', pkcs8, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

async function passcodeKey(passcode: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', toBuffer(utf8.encode(passcode)), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toBuffer(salt), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function wrap(pkcs8: ArrayBuffer, passcode: string): Promise<WrappedKey> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passcodeKey(passcode, salt, PBKDF2_ITERATIONS);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv: toBuffer(iv) }, key, pkcs8);
  return { salt: toB64Url(salt), iv: toB64Url(iv), ct: toB64Url(ct), iter: PBKDF2_ITERATIONS };
}

async function unwrapPkcs8(wrapped: WrappedKey, passcode: string): Promise<ArrayBuffer> {
  const key = await passcodeKey(passcode, fromB64Url(wrapped.salt), wrapped.iter);
  try {
    return await subtle().decrypt({ name: 'AES-GCM', iv: toBuffer(fromB64Url(wrapped.iv)) }, key, toBuffer(fromB64Url(wrapped.ct)));
  } catch {
    throw new WrongPasscodeError();
  }
}

export class WrongPasscodeError extends Error {
  constructor() {
    super('That passcode is not right.');
    this.name = 'WrongPasscodeError';
  }
}

/** A brand-new key pair, plus its passcode-wrapped form for the server. */
export async function createIdentity(passcode: string): Promise<{ identity: Identity; wrapped: WrappedKey }> {
  const pair = (await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const jwk = await subtle().exportKey('jwk', pair.publicKey);
  const pkcs8 = await subtle().exportKey('pkcs8', pair.privateKey);
  const wrapped = await wrap(pkcs8, passcode);

  return {
    identity: {
      keyId: toB64Url(randomBytes(16)),
      publicKey: { kty: 'EC', crv: 'P-256', x: jwk.x!, y: jwk.y! },
      // Re-imported as non-extractable, so script on this page cannot export it.
      privateKey: await importPrivate(pkcs8),
    },
    wrapped,
  };
}

/** Open the server's wrapped copy with the passcode. */
export async function unlockIdentity(
  keyId: string,
  publicKey: PublicJwk,
  wrapped: WrappedKey,
  passcode: string
): Promise<Identity> {
  const pkcs8 = await unwrapPkcs8(wrapped, passcode);
  return { keyId, publicKey, privateKey: await importPrivate(pkcs8) };
}

/** Same key pair, new passcode. Needs the old one to open it first. */
export async function rewrapIdentity(wrapped: WrappedKey, oldPasscode: string, newPasscode: string): Promise<WrappedKey> {
  return wrap(await unwrapPkcs8(wrapped, oldPasscode), newPasscode);
}

// --------------------------------------------------------------- shared keys
const sharedCache = new Map<string, Promise<CryptoKey>>();

function sharedKey(mine: Identity, theirKeyId: string, theirPublic: PublicJwk): Promise<CryptoKey> {
  const cacheKey = `${mine.keyId}|${theirKeyId}`;
  let pending = sharedCache.get(cacheKey);

  if (!pending) {
    pending = (async () => {
      const pub = await subtle().importKey('jwk', { ...theirPublic, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const bits = await subtle().deriveBits({ name: 'ECDH', public: pub }, mine.privateKey, 256);
      const hkdf = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
      // Both sides must use the same salt, so the ids go in sorted.
      const salt = utf8.encode([mine.keyId, theirKeyId].sort().join('|'));
      return subtle().deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: toBuffer(salt), info: toBuffer(utf8.encode(HKDF_INFO)) },
        hkdf,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    })();
    sharedCache.set(cacheKey, pending);
    pending.catch(() => sharedCache.delete(cacheKey));
  }

  return pending;
}

export function forgetSharedKeys(): void {
  sharedCache.clear();
}

// ------------------------------------------------------------------ envelopes
export interface ParsedEnvelope {
  senderKeyId: string;
  recipientKeyId: string;
  header: string;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export function isEnvelope(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(`${ENVELOPE_PREFIX}.`) && value.split('.').length === 5;
}

export function parseEnvelope(value: string): ParsedEnvelope {
  const [version, senderKeyId, recipientKeyId, iv, ct] = value.split('.');
  if (version !== ENVELOPE_PREFIX || !senderKeyId || !recipientKeyId || !iv || !ct) {
    throw new Error('Not an encrypted message.');
  }
  return {
    senderKeyId,
    recipientKeyId,
    header: `${version}.${senderKeyId}.${recipientKeyId}`,
    iv: fromB64Url(iv),
    ciphertext: fromB64Url(ct),
  };
}

/** Encrypt text from me to them. */
export async function seal(mine: Identity, theirKeyId: string, theirPublic: PublicJwk, text: string): Promise<string> {
  const key = await sharedKey(mine, theirKeyId, theirPublic);
  const header = `${ENVELOPE_PREFIX}.${mine.keyId}.${theirKeyId}`;
  const iv = randomBytes(12);
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv: toBuffer(iv), additionalData: toBuffer(utf8.encode(header)) },
    key,
    toBuffer(utf8.encode(text))
  );
  return `${header}.${toB64Url(iv)}.${toB64Url(ct)}`;
}

/**
 * Decrypt an envelope between me and them, whichever direction it went.
 * `theirPublic` must be the key named in the envelope for the other side.
 */
export async function open(mine: Identity, envelope: ParsedEnvelope, theirKeyId: string, theirPublic: PublicJwk): Promise<string> {
  const key = await sharedKey(mine, theirKeyId, theirPublic);
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: toBuffer(envelope.iv), additionalData: toBuffer(utf8.encode(envelope.header)) },
    key,
    toBuffer(envelope.ciphertext)
  );
  return fromUtf8.decode(plain);
}

/**
 * A short code two people can compare in person. The same two keys always
 * give the same code on both phones; if the server ever substituted a key,
 * the codes would differ.
 */
export async function securityCode(a: PublicJwk, b: PublicJwk): Promise<string> {
  const parts = [`${a.x}.${a.y}`, `${b.x}.${b.y}`].sort();
  const digest = new Uint8Array(await subtle().digest('SHA-256', toBuffer(utf8.encode(parts.join('|')))));
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) {
    const n = ((digest[i * 3] << 16) | (digest[i * 3 + 1] << 8) | digest[i * 3 + 2]) % 100000;
    groups.push(String(n).padStart(5, '0'));
  }
  return groups.join(' ');
}

// ------------------------------------------------------------- device store
// The unlocked private key is kept in IndexedDB as a non-extractable
// CryptoKey, so the passcode is asked once per device rather than every visit.
const DB_NAME = 'arrow-secure';
const STORE = 'identities';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadDeviceIdentity(userId: string): Promise<Identity | null> {
  try {
    const found = await withStore<Identity | undefined>('readonly', (s) => s.get(userId));
    return found ?? null;
  } catch {
    return null;
  }
}

export async function saveDeviceIdentity(userId: string, identity: Identity): Promise<void> {
  await withStore('readwrite', (s) => s.put(identity, userId));
}

export async function clearDeviceIdentity(userId?: string): Promise<void> {
  try {
    await withStore('readwrite', (s) => (userId ? s.delete(userId) : s.clear()));
  } catch {
    // Nothing stored, or storage unavailable: either way nothing is left.
  }
  forgetSharedKeys();
}
