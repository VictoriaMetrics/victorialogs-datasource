import { useEffect, useRef, useState } from 'react';
import { from, isObservable } from 'rxjs';

import {
  CoreApp,
  DataFrame,
  FieldType,
  LoadingState,
  PanelData,
  SupplementaryQueryType,
  TimeRange,
  toDataFrame,
} from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { aggregateRawLogsVolume, extractLevel, queryLogsVolume } from '../../../../logsVolumeLegacy';
import { Query, QueryType } from '../../../../types';

import {
  buildDrilldownRequest,
  buildFieldHitsQuery,
  DRILLDOWN_ROW_BARS,
  FIELD_HITS_LIMIT,
  groupHitsByFieldValue,
} from './drilldownQueries';
import { errorMessage } from './errorMessage';
import { FACETS_VALUES_LIMIT } from './facets';

/** Runs the level-grouped hits volume for the current query via the supplementary-query path */
export function useLogsVolume(datasource: VictoriaLogsDatasource, query: Query, range: TimeRange): PanelData {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });

  // adHocFilters is a new array/object on every render even when its contents are unchanged —
  // a stable string key is needed so the effect only re-runs when the filters actually change
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    // force a raw log query: getSupplementaryQuery skips hidden and non-Instant queries
    const rawQuery: Query = { ...query, hide: false, queryType: QueryType.Instant };
    const request = buildDrilldownRequest([rawQuery], range, 'drilldown-volume', CoreApp.Unknown);
    const volumeQuery = datasource.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, rawQuery, request);
    if (!volumeQuery) {
      return;
    }
    const observable = queryLogsVolume(datasource, { ...request, targets: [volumeQuery] });
    if (!observable) {
      return;
    }
    const subscription = observable.subscribe({
      next: (response) => {
        // queryLogsVolume always emits an initial {state: Loading, data: []} before the real
        // result — on a refetch (context changed, same query) that would otherwise wipe the
        // previously rendered series; keep them until the new result (Done/Error) replaces them
        setData((prev) => ({
          series: response.state === LoadingState.Loading && response.data.length === 0 ? prev.series : response.data,
          state: response.state ?? LoadingState.Done,
          timeRange: range,
          errors: response.error ? [response.error] : undefined,
        }));
      },
      error: (e) => {
        setData({ series: [], state: LoadingState.Error, timeRange: range, errors: [{ message: errorMessage(e) }] });
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, query.expr, filtersKey, range.from.valueOf(), range.to.valueOf()]);

  return data;
}

/** Per-value volume, level-stacked the same way as the main logs-volume panel */
export interface FieldValueVolume {
  value: string;
  total: number;
  volumeData: PanelData;
}

/** Runs a hits query grouped by the given field plus level fields, and returns the top values */
export function useFieldValuesHits(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string | undefined,
  range: TimeRange
): { top: FieldValueVolume[]; totalValues: number; loading: boolean; error?: string; serverTruncated: boolean } {
  const [top, setTop] = useState<FieldValueVolume[]>([]);
  const [totalValues, setTotalValues] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [serverTruncated, setServerTruncated] = useState(false);
  // tracks the field this hook last fetched for — used to tell a content-identity change
  // (a different field, whose previous rows must never leak into the new tab) apart from a
  // context-only refetch (range/filters/expr changed, same field, previous rows stay visible)
  const previousFieldRef = useRef(field);

  // adHocFilters is a new array/object on every render even when its contents are unchanged —
  // a stable string key is needed so the effect only re-runs when the filters actually change
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    const fieldChanged = previousFieldRef.current !== field;
    previousFieldRef.current = field;

    if (!field) {
      setTop([]);
      setTotalValues(0);
      setError(undefined);
      setServerTruncated(false);
      // a request may still be pending from the previous field — its subscription is
      // dropped by the effect cleanup, so the loading flag must be reset here
      setLoading(false);
      return;
    }
    if (fieldChanged) {
      // a different field is a content-identity change — clear immediately so the new tab
      // never renders rows still belonging to the field that was active a moment ago
      setTop([]);
      setTotalValues(0);
      setServerTruncated(false);
    }
    setLoading(true);
    setError(undefined);
    // level fields are requested alongside the drilldown field so each value's volume
    // can be split by level the same way as the main logs-volume panel
    const levelFields = datasource.getActiveLevelRules().map((r) => r.field).filter(Boolean);
    const hitsFields = Array.from(new Set([field, ...levelFields, 'level']));
    // VictoriaLogs' fields_limit bounds unique (field,level,...) tuples, not field values alone —
    // scale the default per-field bound by the number of grouping fields so the tuple space isn't
    // truncated far below FIELD_HITS_LIMIT distinct values
    const target = { ...buildFieldHitsQuery(query, range, hitsFields), fieldsLimit: FIELD_HITS_LIMIT * hitsFields.length };
    const request = buildDrilldownRequest([target], range, `drilldown-hits-${field}`);
    const response = datasource.query(request);
    const observable = isObservable(response) ? response : from(Promise.resolve(response));
    let frames: DataFrame[] = [];
    let hadError = false;
    const subscription = observable.subscribe({
      next: (resp) => {
        // datasource.query() can deliver a per-query error in-band on a next-emission rather
        // than through the observable's error channel — surface it instead of accumulating
        // an incomplete/empty frame set as if the request had succeeded
        if (resp.error) {
          hadError = true;
          setError(resp.error.message ?? errorMessage(resp.error));
          setLoading(false);
          return;
        }
        frames = frames.concat(resp.data.map(toDataFrame));
      },
      error: (e) => {
        setError(errorMessage(e));
        setLoading(false);
      },
      complete: () => {
        // an in-band error was already reported in `next` — don't overwrite it with partial data
        if (hadError) {
          return;
        }
        const grouped = groupHitsByFieldValue(frames, field);
        setTop(
          grouped.top.map(({ value, total, frames: valueFrames }) => ({
            value,
            total,
            volumeData: {
              // reuses the level-grouping/coloring pipeline of the main logs-volume path, but with
              // the narrower row-chart bucket count so the grid matches the query's own step
              series: aggregateRawLogsVolume(valueFrames, extractLevel, request, datasource.logLevelRules, DRILLDOWN_ROW_BARS),
              state: LoadingState.Done,
              timeRange: range,
            },
          }))
        );
        setTotalValues(grouped.totalValues);
        setServerTruncated(grouped.serverTruncated);
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, query.expr, filtersKey, field, range.from.valueOf(), range.to.valueOf()]);

  return { top, totalValues, loading, error, serverTruncated };
}

/** Runs a hits query grouped by one field for a breakdown card chart — one series per value; idle until enabled */
export function useFieldVolume(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string,
  range: TimeRange,
  enabled: boolean
): PanelData {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });

  // adHocFilters is a new array/object on every render even when its contents are unchanged —
  // a stable string key is needed so the effect only re-runs when the filters actually change
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, state: LoadingState.Loading }));
    // the card chart mirrors the facets summary — the same top-N values, one series each
    const target = { ...buildFieldHitsQuery(query, range, [field]), fieldsLimit: FACETS_VALUES_LIMIT };
    const request = buildDrilldownRequest([target], range, `drilldown-field-volume-${field}`);
    const response = datasource.query(request);
    const observable = isObservable(response) ? response : from(Promise.resolve(response));
    let frames: DataFrame[] = [];
    const subscription = observable.subscribe({
      next: (resp) => {
        if (resp.error) {
          setData({ series: [], state: LoadingState.Error, timeRange: range, errors: [resp.error] });
          return;
        }
        frames = frames.concat(resp.data.map(toDataFrame));
      },
      error: (e) => {
        setData({ series: [], state: LoadingState.Error, timeRange: range, errors: [{ message: errorMessage(e) }] });
      },
      complete: () => {
        setData((prev) => {
          if (prev.state === LoadingState.Error) {
            // an in-band error was already reported in `next` — don't overwrite it with partial data
            return prev;
          }
          // hits past fields_limit are merged into an unattributable series with no labels — drop it,
          // the card's "top N" framing already tells the user the chart isn't exhaustive
          const labeled = frames
            .filter((frame) =>
              frame.fields.some((f) => f.type === FieldType.number && f.labels && Object.keys(f.labels).length > 0)
            )
            // name each series after the field's value instead of the raw {field="value"} label pair,
            // so the card's bottom legend reads as a plain value list
            .map((frame) => ({
              ...frame,
              fields: frame.fields.map((f) =>
                f.type === FieldType.number && f.labels?.[field] !== undefined
                  ? { ...f, config: { ...f.config, displayNameFromDS: f.labels[field] || '(empty)' } }
                  : f
              ),
            }));
          return { series: labeled, state: LoadingState.Done, timeRange: range };
        });
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, enabled, query.expr, filtersKey, field, range.from.valueOf(), range.to.valueOf()]);

  return data;
}

/** Single-series volume for a visible breakdown-table row (a pattern or a field value): the sum of the series is the row's exact count */
export function useTargetVolume(
  datasource: VictoriaLogsDatasource,
  target: Query,
  range: TimeRange
): { data: PanelData; total?: number } {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });
  const [total, setTotal] = useState<number>();

  // adHocFilters is a new array/object on every render even when its contents are unchanged —
  // a stable string key is needed so the effect only re-runs when the filters actually change
  const filtersKey = JSON.stringify(target.adHocFilters ?? []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, state: LoadingState.Loading }));
    // the target's refId doubles as the requestId — it already carries the per-row suffix
    const request = buildDrilldownRequest([target], range, target.refId);
    const response = datasource.query(request);
    const observable = isObservable(response) ? response : from(Promise.resolve(response));
    let frames: DataFrame[] = [];
    const subscription = observable.subscribe({
      next: (resp) => {
        if (resp.error) {
          setData({ series: [], state: LoadingState.Error, timeRange: range, errors: [resp.error] });
          return;
        }
        frames = frames.concat(resp.data.map(toDataFrame));
      },
      error: (e) => {
        setData({ series: [], state: LoadingState.Error, timeRange: range, errors: [{ message: errorMessage(e) }] });
      },
      complete: () => {
        setData((prev) => {
          if (prev.state === LoadingState.Error) {
            return prev;
          }
          const sum = frames.reduce(
            (acc, frame) =>
              acc +
              frame.fields
                .filter((f) => f.type === FieldType.number)
                .reduce((fieldAcc, f) => fieldAcc + f.values.reduce((a: number, v) => a + (v ?? 0), 0), 0),
            0
          );
          setTotal(sum);
          return { series: frames, state: LoadingState.Done, timeRange: range };
        });
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, target.expr, filtersKey, target.refId, range.from.valueOf(), range.to.valueOf()]);

  return { data, total };
}
