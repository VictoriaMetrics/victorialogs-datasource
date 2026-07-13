import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { from, isObservable, Unsubscribable } from 'rxjs';

import { DataFrame, DataQueryRequest, LoadingState, PanelData, TimeRange, toDataFrame } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import {
  buildDrilldownRequest,
  buildPatternLogsQuery,
  buildRawLogsQuery,
  buildValueLogsQuery,
} from './drilldownQueries';
import { errorMessage } from './errorMessage';

/** Runs a single-target drilldown request and applies the shared next/error/complete state machine used by all logs-sample hooks */
function subscribeLogsSample(
  datasource: VictoriaLogsDatasource,
  request: DataQueryRequest<Query>,
  range: TimeRange,
  setData: Dispatch<SetStateAction<PanelData>>
): Unsubscribable {
  const response = datasource.query(request);
  const observable = isObservable(response) ? response : from(Promise.resolve(response));
  let frames: DataFrame[] = [];
  return observable.subscribe({
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
      // an in-band error may have already been reported — don't overwrite it
      setData((prev) =>
        prev.state === LoadingState.Error ? prev : { series: frames, state: LoadingState.Done, timeRange: range }
      );
    },
  });
}

/** Runs a raw-logs query for the drill-in Logs tab — the query's filters already narrow the selection; idle until enabled */
export function useQueryLogsSample(
  datasource: VictoriaLogsDatasource,
  query: Query,
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
    // a context-only refetch (range/filters changed) keeps the previous series visible (dimmed)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, state: LoadingState.Loading }));
    const target = buildRawLogsQuery(query);
    const request = buildDrilldownRequest([target], range, 'drilldown-raw-logs');
    const subscription = subscribeLogsSample(datasource, request, range, setData);
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, enabled, query.expr, filtersKey, range.from.valueOf(), range.to.valueOf()]);

  return data;
}

/** Runs a raw-logs sample query for one field value; idle until enabled */
export function useValueLogsSample(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string,
  value: string,
  range: TimeRange,
  enabled: boolean,
  refIdSuffix: number
): PanelData {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });
  // tracks field:value so a genuine identity change (a different value) resets the sample
  // immediately, while a context-only refetch (range changed, same value) keeps the previous
  // series visible (dimmed) until the new result replaces it
  const previousIdentityRef = useRef(`${field}:${value}`);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const identity = `${field}:${value}`;
    const identityChanged = previousIdentityRef.current !== identity;
    previousIdentityRef.current = identity;

    setData((prev) =>
      identityChanged ? { series: [], state: LoadingState.Loading, timeRange: range } : { ...prev, state: LoadingState.Loading }
    );
    const target = buildValueLogsQuery(query, field, value, refIdSuffix);
    const request = buildDrilldownRequest([target], range, `drilldown-logs-${refIdSuffix}`);
    const subscription = subscribeLogsSample(datasource, request, range, setData);
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, enabled, query.expr, field, value, refIdSuffix, range.from.valueOf(), range.to.valueOf()]);

  return data;
}

/** Runs a raw-logs sample query for one collapsed message pattern; idle until enabled */
export function usePatternLogsSample(
  datasource: VictoriaLogsDatasource,
  query: Query,
  pattern: string,
  range: TimeRange,
  enabled: boolean,
  refIdSuffix: number
): PanelData {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });
  // tracks the pattern so a genuine identity change resets the sample immediately, while a
  // context-only refetch (range changed, same pattern) keeps the previous series visible (dimmed)
  const previousPatternRef = useRef(pattern);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const identityChanged = previousPatternRef.current !== pattern;
    previousPatternRef.current = pattern;

    setData((prev) =>
      identityChanged ? { series: [], state: LoadingState.Loading, timeRange: range } : { ...prev, state: LoadingState.Loading }
    );
    const target = buildPatternLogsQuery(query, pattern, refIdSuffix);
    const request = buildDrilldownRequest([target], range, `drilldown-pattern-logs-${refIdSuffix}`);
    const subscription = subscribeLogsSample(datasource, request, range, setData);
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, enabled, query.expr, pattern, refIdSuffix, range.from.valueOf(), range.to.valueOf()]);

  return data;
}
