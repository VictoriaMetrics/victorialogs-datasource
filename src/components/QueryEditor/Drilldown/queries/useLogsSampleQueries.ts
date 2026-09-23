import { useEffect, useRef, useState } from 'react';

import { LoadingState, PanelData, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import {
  buildDrilldownRequest,
  buildFieldPresenceLogsQuery,
  buildPatternLogsQuery,
  buildRawLogsQuery,
  buildValueLogsQuery,
} from './drilldownQueries';
import { runDrilldownQuery } from './runDrilldownQuery';

interface LogsSampleOptions {
  /** What the sample is of. A new identity clears the previous series at once, a refetch of the same one keeps it on screen */
  identity: string;
  buildTarget: () => Query;
  requestId: string;
  enabled: boolean;
  /** Extra effect dependencies beyond the identity and the target's adHocFilters, such as the query expression */
  deps: unknown[];
}

/** Runs one raw-logs query and keeps its result in PanelData form */
function useLogsSample(
  datasource: VictoriaLogsDatasource,
  range: TimeRange,
  { identity, buildTarget, requestId, enabled, deps }: LogsSampleOptions
): PanelData {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });
  const previousIdentityRef = useRef(identity);
  // adHocFilters is a new array on every render, so the effect keys off its contents instead.
  // Keying off the built target covers every sample kind, since each copies the query's chips
  const filtersKey = JSON.stringify(buildTarget().adHocFilters ?? []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const identityChanged = previousIdentityRef.current !== identity;
    previousIdentityRef.current = identity;

    setData((prev) =>
      identityChanged ? { series: [], state: LoadingState.Loading, timeRange: range } : { ...prev, state: LoadingState.Loading }
    );
    const request = buildDrilldownRequest([buildTarget()], range, requestId);
    const subscription = runDrilldownQuery(datasource, request, {
      onError: (errors) => setData({ series: [], state: LoadingState.Error, timeRange: range, errors }),
      onFrames: (frames) => setData({ series: frames, state: LoadingState.Done, timeRange: range }),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, enabled, identity, requestId, range.from.valueOf(), range.to.valueOf(), filtersKey, ...deps]);

  return data;
}

/** Raw logs for the Logs tab. The query's own filters already narrow the selection. Idle until `enabled` */
export function useQueryLogsSample(
  datasource: VictoriaLogsDatasource,
  query: Query,
  range: TimeRange,
  enabled: boolean
): PanelData {
  return useLogsSample(datasource, range, {
    identity: 'raw-logs',
    buildTarget: () => buildRawLogsQuery(query),
    requestId: 'drilldown-raw-logs',
    enabled,
    deps: [query.expr],
  });
}

/** Raw-logs sample for one field value. Idle until `enabled` */
export function useValueLogsSample(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string,
  value: string,
  range: TimeRange,
  enabled: boolean,
  refIdSuffix: number
): PanelData {
  return useLogsSample(datasource, range, {
    identity: `${field}:${value}`,
    buildTarget: () => buildValueLogsQuery(query, field, value, refIdSuffix),
    requestId: `drilldown-logs-${refIdSuffix}`,
    enabled,
    deps: [query.expr, refIdSuffix],
  });
}

/** Raw-logs sample for the logs that carry one stream field. Idle until `enabled` */
export function useFieldLogsSample(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string,
  range: TimeRange,
  enabled: boolean,
  refIdSuffix: number
): PanelData {
  return useLogsSample(datasource, range, {
    identity: field,
    buildTarget: () => buildFieldPresenceLogsQuery(query, field, refIdSuffix),
    requestId: `drilldown-field-logs-${refIdSuffix}`,
    enabled,
    deps: [query.expr, refIdSuffix],
  });
}

/** Raw-logs sample for one collapsed message pattern. Idle until `enabled` */
export function usePatternLogsSample(
  datasource: VictoriaLogsDatasource,
  query: Query,
  pattern: string,
  range: TimeRange,
  enabled: boolean,
  refIdSuffix: number
): PanelData {
  return useLogsSample(datasource, range, {
    identity: pattern,
    buildTarget: () => buildPatternLogsQuery(query, pattern, refIdSuffix),
    requestId: `drilldown-pattern-logs-${refIdSuffix}`,
    enabled,
    deps: [query.expr, refIdSuffix],
  });
}
