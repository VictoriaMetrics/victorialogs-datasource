/**
 * Simple LRU (Least Recently Used) cache backed by a Map.
 * Uses Map insertion-order guarantees: the first key is the oldest,
 * the last key is the most recently used.
 */
export class LRUCache<V> {
  private readonly cache = new Map<string, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key) as V;
    // Promote to most-recently-used by re-inserting
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }
}
