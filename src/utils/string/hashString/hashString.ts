/**
 * Returns a deterministic base36 hash of a string.
 *
 * Fast non-cryptographic hash (the Java String.hashCode polynomial), suitable for
 * cache keys, channel paths and identity checks. It is not collision-proof and not
 * for security use.
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // `| 0` keeps the accumulator within 32 bits; without it the value would
    // grow past 2^53 and lose precision
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
