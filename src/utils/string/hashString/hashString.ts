/**
 * Returns a deterministic, fixed-length 7-character base36 hash of a string.
 *
 * Fast non-cryptographic hash (djb2-style via Math.imul), suitable for cache keys,
 * channel paths and identity checks. It is not collision-proof and not for security use.
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  // base36 of a 32-bit value is at most 7 chars; left-pad to keep the length fixed
  return (hash >>> 0).toString(36).padStart(7, '0');
}
