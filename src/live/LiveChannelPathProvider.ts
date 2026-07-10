import { Query } from '../types';
import { hashString } from '../utils';

interface ChannelState {
  payload: string;
  generation: number;
  path: string;
}

/**
 * Serializes the query fields that affect the backend live tail request
 */
function serializeLiveQuery(query: Query): string {
  return JSON.stringify({
    expr: query.expr,
    extraFilters: query.extraFilters,
    extraStreamFilters: query.extraStreamFilters,
  });
}

/**
 * Builds Grafana Live channel paths for live tailing.
 *
 * Grafana Live de-duplicates subscriptions by channel address, and the backend
 * snapshots the query from the subscribe payload only once per channel
 * (RunStream). The path must therefore change whenever the query content
 * changes — otherwise editing `expr` would keep streaming the previous query —
 * and must NOT change otherwise, or an active stream would restart and lose
 * its accumulated log buffer.
 *
 * The path suffix combines a generation counter with a content hash:
 * - the generation is bumped on every payload change (exact string comparison),
 *   which guarantees a new path even if two payloads collide in the 32-bit hash;
 * - the hash keeps paths content-addressed across page reloads, where the
 *   in-memory generation counter starts over from zero.
 */
export class LiveChannelPathProvider {
  private channels = new Map<string, ChannelState>();

  getPath(requestId: string, query: Query): string {
    const key = this.buildKey(requestId, query.refId);
    const payload = serializeLiveQuery(query);
    let state = this.channels.get(key);
    if (!state || state.payload !== payload) {
      const generation = state ? state.generation + 1 : 0;
      state = { payload, generation, path: `${key}/${generation}-${hashString(payload)}` };
      this.channels.set(key, state);
    }
    return state.path;
  }

  /**
   * Drops the stored channel state once the live stream for `path` ends.
   * A stale `path` (already replaced by a newer generation) is ignored, so a
   * late teardown of the previous stream cannot evict the active state.
   */
  release(requestId: string, refId: string, path: string): void {
    const key = this.buildKey(requestId, refId);
    if (this.channels.get(key)?.path === path) {
      this.channels.delete(key);
    }
  }

  private buildKey(requestId: string, refId: string): string {
    return `${requestId}/${refId}`;
  }
}
