import React, { ReactNode } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  CoreApp,
  DataQueryRequest,
  DataFrame,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
  rangeUtil,
  TimeRange,
  toUtc,
} from '@grafana/data';

import type { VictoriaLogsDatasource } from '../datasource';
import { escapeLabelValueInExactSelector, escapeLabelValueInSelector } from '../languageUtils';
import { Query } from '../types';

import { LogContextUI } from './components/LogContextUI';

export const REF_ID_STARTER_LOG_CONTEXT_REQUEST = 'log-context-request-';
export const REF_ID_STARTER_LOG_CONTEXT_QUERY = 'log-context-query-';
export const LABEL_STREAM_ID = '_stream_id';
export const LABEL_STREAM = '_stream';

const SIMPLE_SELECTOR_KEY_REGEXP = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

// stream label names are quoted unless they are simple identifiers,
// so that names with spaces or special characters stay valid LogsQL
function formatStreamSelectorKey(key: string): string {
  return SIMPLE_SELECTOR_KEY_REGEXP.test(key) ? key : `"${escapeLabelValueInExactSelector(key)}"`;
}

/**
 * "Show context" feature:
 *   - stream label toggle state,
 *   - context query building,
 *   - modal UI
 * The datasource delegates its DataSourceWithLogsContextSupport methods here
 */
export class LogContextProvider {
  // per-stream set of toggled-off label keys; lives on the provider instance so
  // it survives modal re-renders and is visible to getLogRowContext
  private disabledStreamLabels: Map<string, Set<string>> = new Map();

  constructor(private readonly datasource: VictoriaLogsDatasource) {}

  getRowStreamId = (row: LogRowModel): string => {
    const streamIds = row.dataFrame.meta?.custom?.streamIds;
    if (streamIds && streamIds.length > 0 && streamIds[row.rowIndex]) {
      return streamIds[row.rowIndex];
    }

    return '';
  };

  getStreamLabels = (row: LogRowModel): Record<string, string> => {
    const streams = row.dataFrame.meta?.custom?.streams as Array<Record<string, string> | null> | undefined;
    // a missing `_stream` field comes back as null from the backend
    return streams?.[row.rowIndex] ?? {};
  };

  // whether the row carries enough data to build a context query: either a
  // `_stream_id` or at least one `_stream` label. With neither, the modal
  // cannot scope the context search and shows an explanatory message instead
  hasContextData = (row: LogRowModel): boolean => {
    return Boolean(this.getRowStreamId(row)) || Object.keys(this.getStreamLabels(row)).length > 0;
  };

  isStreamLabelEnabled = (streamId: string, key: string): boolean => {
    return !this.disabledStreamLabels.get(streamId)?.has(key);
  };

  toggleStreamLabel = (streamId: string, key: string): void => {
    const disabled = this.disabledStreamLabels.get(streamId) ?? new Set<string>();
    if (disabled.has(key)) {
      disabled.delete(key);
    } else {
      disabled.add(key);
    }
    this.disabledStreamLabels.set(streamId, disabled);
  };

  // drops the toggle state for a stream so selections don't persist between
  // "Show context" modal openings; called when the modal UI unmounts
  resetStreamLabels = (streamId: string): void => {
    this.disabledStreamLabels.delete(streamId);
  };

  // builds a `_stream:{...}` selector from the given label keys
  private buildStreamSelector = (labels: Record<string, string>, keys: string[]): string => {
    const selector = keys
      .map((key) => `${formatStreamSelectorKey(key)}="${escapeLabelValueInSelector(labels[key])}"`)
      .join(',');
    return `${LABEL_STREAM}:{${selector}}`;
  };

  private buildContextFilterExpr = (row: LogRowModel): string => {
    const streamId = this.getRowStreamId(row);
    const labels = this.getStreamLabels(row);
    const keys = Object.keys(labels);
    const disabled = this.disabledStreamLabels.get(streamId);
    const selected = keys.filter((key) => !disabled?.has(key));

    // no `_stream_id`: the only way to scope the context is by stream labels.
    // an empty set would make the query unbounded — the UI keeps at least one
    // label enabled, fall back to all labels defensively anyway
    if (!streamId) {
      return keys.length ? this.buildStreamSelector(labels, selected.length ? selected : keys) : '';
    }

    const byStreamId = `${LABEL_STREAM_ID}:"${streamId}"`;

    // no labels, or the user hasn't narrowed anything: use the exact stream id
    if (!keys.length || !disabled?.size) {
      return byStreamId;
    }

    // a full set means nothing is narrowed; an empty set would make the query
    // unbounded — the UI prevents it, fall back defensively anyway
    if (!selected.length || selected.length === keys.length) {
      return byStreamId;
    }

    return this.buildStreamSelector(labels, selected);
  };

  private prepareLogContextQueryExpr = (row: LogRowModel, direction: LogRowContextQueryDirection): string => {
    const sortDir = direction === LogRowContextQueryDirection.Forward ? 'asc' : 'desc';
    return `${this.buildContextFilterExpr(row)} | sort by (_time) ${sortDir}`;
  };

  getLogRowContext = async (
    row: LogRowModel,
    options?: LogRowContextOptions,
  ): Promise<{ data: DataFrame[] }> => {
    const contextRequest = this.makeLogContextDataRequest(row, options);
    return lastValueFrom(this.datasource.runQuery(contextRequest));
  };

  getLogRowContextQuery = async (
    row: LogRowModel,
    options?: LogRowContextOptions
  ): Promise<Query | null> => {
    const direction = options?.direction || LogRowContextQueryDirection.Backward;
    return {
      expr: this.prepareLogContextQueryExpr(row, direction),
      refId: `${REF_ID_STARTER_LOG_CONTEXT_QUERY}${row.dataFrame.refId}-${direction}`,
    };
  };

  getLogRowContextUi = (row: LogRowModel, runContextQuery?: () => void): ReactNode => {
    return <LogContextUI provider={this} row={row} runContextQuery={runContextQuery} />;
  };

  private makeLogContextDataRequest = (row: LogRowModel, options?: LogRowContextOptions): DataQueryRequest<Query> => {
    const direction = options?.direction || LogRowContextQueryDirection.Backward;

    const query: Query = {
      expr: this.prepareLogContextQueryExpr(row, direction),
      refId: `${REF_ID_STARTER_LOG_CONTEXT_QUERY}${row.dataFrame.refId}-${direction}`
    };

    const range = this.createContextTimeRange(row.timeEpochMs, direction);

    const interval = rangeUtil.calculateInterval(range, 1);

    return {
      app: CoreApp.Explore,
      interval: interval.interval,
      intervalMs: interval.intervalMs,
      range: range,
      requestId: `${REF_ID_STARTER_LOG_CONTEXT_REQUEST}${row.dataFrame.refId}-${direction}`,
      scopedVars: {},
      startTime: Date.now(),
      targets: [query],
      timezone: 'UTC'
    };
  };

  private createContextTimeRange = (rowTimeEpochMs: number, direction?: LogRowContextQueryDirection): TimeRange => {
    const offset = 2 * 60 * 60 * 1000;  // 2h
    const overlap = 1000;

    const timeRange =
      direction === LogRowContextQueryDirection.Backward
        ? {
          from: toUtc(rowTimeEpochMs - offset),
          to: toUtc(rowTimeEpochMs + overlap)
        }
        : {
          from: toUtc(rowTimeEpochMs),
          to: toUtc(rowTimeEpochMs + offset) // Add 1 second to avoid missing results
        };

    return { ...timeRange, raw: timeRange };
  };
}
