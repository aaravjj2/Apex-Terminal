// ============================================================================
// UUID Generation (v4)
// ============================================================================

export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint8Array(16))
    : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));

  const b = Array.from(bytes);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx

  const hex = b.map(v => v.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function shortId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, v => chars[v % chars.length]).join('');
  }
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ============================================================================
// Hash Functions (Non-cryptographic)
// ============================================================================

export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function murmurHash3(str: string, seed = 0): number {
  let h1 = seed;
  const len = str.length;
  const c1 = 0xcc9e2d51, c2 = 0x1b873593;

  let i = 0;
  while (i + 4 <= len) {
    let k1 = (str.charCodeAt(i) & 0xff)
      | ((str.charCodeAt(i + 1) & 0xff) << 8)
      | ((str.charCodeAt(i + 2) & 0xff) << 16)
      | ((str.charCodeAt(i + 3) & 0xff) << 24);

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
    i += 4;
  }

  let k1 = 0;
  switch (len & 3) {
    case 3: k1 ^= (str.charCodeAt(i + 2) & 0xff) << 16; // falls through
    case 2: k1 ^= (str.charCodeAt(i + 1) & 0xff) << 8;  // falls through
    case 1:
      k1 ^= str.charCodeAt(i) & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

export function hashToHex(value: number): string {
  return value.toString(16).padStart(8, '0');
}

export function hashString(str: string): string {
  return hashToHex(murmurHash3(str));
}

// ============================================================================
// Random String Generation
// ============================================================================

const CHARSET_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CHARSET_ALPHANUM = CHARSET_ALPHA + '0123456789';
const CHARSET_HEX = '0123456789abcdef';
const CHARSET_BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomString(length: number, charset: string): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, v => charset[v % charset.length]).join('');
  }
  return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
}

export function randomAlphanumeric(length: number): string {
  return randomString(length, CHARSET_ALPHANUM);
}

export function randomHex(length: number): string {
  return randomString(length, CHARSET_HEX);
}

export function randomBase62(length: number): string {
  return randomString(length, CHARSET_BASE62);
}

// ============================================================================
// API Key Generation
// ============================================================================

export function generateApiKey(prefix = 'tv'): string {
  const key = randomBase62(32);
  return `${prefix}_${key}`;
}

export function generateApiSecret(): string {
  return randomBase62(48);
}

export function maskApiKey(key: string, visibleChars = 4): string {
  if (key.length <= visibleChars) return '•'.repeat(key.length);
  return key.slice(0, visibleChars) + '•'.repeat(Math.min(key.length - visibleChars, 24));
}

// ============================================================================
// Session Token Management
// ============================================================================

export interface SessionToken {
  token: string;
  createdAt: number;
  expiresAt: number;
  fingerprint: string;
}

export function createSessionToken(ttlMs = 3600000): SessionToken {
  const now = Date.now();
  return {
    token: `sess_${randomBase62(40)}`,
    createdAt: now,
    expiresAt: now + ttlMs,
    fingerprint: randomHex(16),
  };
}

export function isTokenExpired(token: SessionToken): boolean {
  return Date.now() > token.expiresAt;
}

export function refreshToken(token: SessionToken, ttlMs = 3600000): SessionToken {
  return {
    ...token,
    token: `sess_${randomBase62(40)}`,
    expiresAt: Date.now() + ttlMs,
  };
}

// ============================================================================
// Checksum Calculation
// ============================================================================

export function crc32(data: string): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function adler32(data: string): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data.charCodeAt(i)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export function checksumHex(data: string, algorithm: 'crc32' | 'adler32' | 'fnv1a' = 'crc32'): string {
  const fn = algorithm === 'crc32' ? crc32 : algorithm === 'adler32' ? adler32 : fnv1a;
  return fn(data).toString(16).padStart(8, '0');
}

export function verifyChecksum(data: string, expected: string, algorithm: 'crc32' | 'adler32' | 'fnv1a' = 'crc32'): boolean {
  return checksumHex(data, algorithm) === expected;
}
