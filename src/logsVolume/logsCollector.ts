import { DataFrame, DataQueryResponse, FieldType } from '@grafana/data';

import { volumeRefId } from '../constants';
import { appendLogsFrame, emptyLogsFrame } from '../transformers/utils/frame/frameUtils';
import { Query } from '../types';

import { LogsProgress } from './IncrementalHitsLoadingController';

/** The logs collected bar by bar for the visible targets of one run */
export class LogsCollector {
  private readonly collected = new Map<DataFrame['refId'], DataFrame>();

  constructor(private readonly targets: Query[]) {}

  /** The targets with hits in the bar that still miss lines, each asking only for the lines it misses */
  targetsMissingLogs(hits: DataQueryResponse): Query[] {
    const withHits = refIdsWithHits(hits);
    return this.targets
      .filter((target) => withHits.has(volumeRefId(target.refId)))
      .map((target) => ({ ...target, maxLines: limitOf(target) - this.loaded(target.refId) }))
      .filter((target) => target.maxLines > 0);
  }

  add(frames: DataFrame[]): void {
    frames.forEach((frame) => {
      const collected = this.collected.get(frame.refId);
      this.collected.set(frame.refId, collected ? appendLogsFrame(collected, frame) : frame);
    });
  }

  /** One frame per target, an empty one before its first logs */
  get logs(): DataFrame[] {
    return this.targets.map(({ refId }) => this.collected.get(refId) ?? emptyLogsFrame(refId));
  }

  get progress(): LogsProgress[] {
    return this.targets.map((target) => ({ refId: target.refId, loaded: this.loaded(target.refId), limit: limitOf(target) }));
  }

  private loaded(refId: string): number {
    return this.collected.get(refId)?.length ?? 0;
  }
}

const limitOf = (target: Query): number => target.maxLines ?? 0;

const refIdsWithHits = (hits: DataQueryResponse): Set<DataFrame['refId']> =>
  new Set(hits.data.filter(hasHits).map((frame: DataFrame) => frame.refId));

const hasHits = (frame: DataFrame): boolean =>
  frame.fields.some((field) => field.type === FieldType.number && field.values.some((value) => value > 0));
