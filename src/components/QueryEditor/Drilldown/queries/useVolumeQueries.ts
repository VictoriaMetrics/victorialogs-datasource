import { useEffect, useMemo, useRef, useState } from 'react';

import { CoreApp, FieldType, LoadingState, PanelData, SupplementaryQueryType, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { aggregateRawLogsVolume, extractLevel, queryLogsVolume } from '../../../../logsVolumeLegacy';
import { Query, QueryType } from '../../../../types';
import { buildLevelGrouping, DERIVED_LEVEL_VALUE_COUNT } from '../../../../utils/query/levelFormatPipes';

import {
  buildDrilldownRequest,
  buildFieldHitsQuery,
  DRILLDOWN_ROW_BARS,
  FIELD_HITS_LIMIT,
  FieldValueFrames,
  getDrilldownLevelRules,
  groupHitsByFieldValue,
  withLevelPipes,
} from './drilldownQueries';
import { errorMessage } from './errorMessage';
import { FACETS_VALUES_LIMIT } from './facets';
import { drilldownQueryScheduler } from './queryScheduler';
import { responseErrors, runDrilldownQuery, toErrorText } from './runDrilldownQuery';

/**
 * Headroom per field value when hits group by the raw `level` field, whose cardinality the
 * plugin does not control. It covers one casing of every known level alias plus a missing
 * level. `fields_limit` is a budget shared by all tuples, so values with fewer levels leave
 * room for the rest, and a real overflow still surfaces as the labels-less remainder series
 * that `groupHitsByFieldValue` turns into `serverTruncated`
 */
export const RAW_LEVEL_BUCKETS = 20;

/** Level-grouped hits volume for the current query, run through the supplementary-query path */
export function useLogsVolume(datasource: VictoriaLogsDatasource, query: Query, range: TimeRange): PanelData {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });

  // adHocFilters is a new array on every render, so the effect keys off its contents instead
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    // getSupplementaryQuery skips hidden and non-Instant queries, so force both fields here
    const rawQuery: Query = { ...query, hide: false, queryType: QueryType.Instant };
    const request = buildDrilldownRequest([rawQuery], range, 'drilldown-volume', CoreApp.Unknown);
    const volumeQuery = datasource.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, rawQuery, request);
    const observable = volumeQuery && queryLogsVolume(datasource, { ...request, targets: [volumeQuery] });
    if (!observable) {
      // this query has no volume. Settle the state, otherwise a Loading left by a cancelled
      // previous request would never end
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData({ series: [], state: LoadingState.Done, timeRange: range });
      return;
    }
    // report Loading at once: the scheduler may hold the request back behind other queries,
    // and until the first emission the panel would otherwise render nothing
    setData((prev) => ({ ...prev, state: LoadingState.Loading, timeRange: range }));
    // the observable from queryLogsVolume is cold, so scheduling holds back both the
    // subscription and the request until the shared limiter grants a slot
    const subscription = drilldownQueryScheduler.schedule(() => observable).subscribe({
      next: (response) => {
        const errors = responseErrors(response);
        // queryLogsVolume always emits {state: Loading, data: []} before the real result.
        // Keeping the previous series stops a refetch from blanking the chart
        setData((prev) => ({
          series: response.state === LoadingState.Loading && response.data.length === 0 ? prev.series : response.data,
          state: response.state ?? LoadingState.Done,
          timeRange: range,
          errors: errors.length ? errors : undefined,
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

/** One value's volume, stacked by level the way the main logs-volume panel stacks it */
export interface FieldValueVolume {
  value: string;
  total: number;
  volumeData: PanelData;
}

export interface FieldValueFramesResult {
  groups: FieldValueFrames[];
  totalValues: number;
  loading: boolean;
  error?: string;
  serverTruncated: boolean;
}

/**
 * Runs one hits query grouped by the field plus the level fields and returns the raw per-value
 * frames. Every per-value volume of that field reads them, so a page of breakdown rows costs
 * one range scan instead of one query per row
 */
export function useFieldValueFrames(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string | undefined,
  range: TimeRange
): FieldValueFramesResult {
  const [groups, setGroups] = useState<FieldValueFrames[]>([]);
  const [totalValues, setTotalValues] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [serverTruncated, setServerTruncated] = useState(false);
  // the field this hook last fetched for. It separates a switch to another field, where the
  // old rows must disappear at once, from a refetch of the same field, where they stay visible
  const previousFieldRef = useRef(field);

  // adHocFilters is a new array on every render, so the effect keys off its contents instead
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    const fieldChanged = previousFieldRef.current !== field;
    previousFieldRef.current = field;

    if (!field) {
      setGroups([]);
      setTotalValues(0);
      setError(undefined);
      setServerTruncated(false);
      // the previous field may still have a request in flight. The effect cleanup drops its
      // subscription but not the loading flag, so reset it here
      setLoading(false);
      return;
    }
    if (fieldChanged) {
      // clear at once, so the new tab never renders rows belonging to the previous field
      setGroups([]);
      setTotalValues(0);
      setServerTruncated(false);
    }
    setLoading(true);
    setError(undefined);
    // the query groups by the level fields as well, so each value's volume can be stacked by
    // level with the same server-side derivation the main logs-volume panel uses
    const grouping = buildLevelGrouping(datasource.getActiveLevelRules());
    const hitsFields = Array.from(new Set([field, ...grouping.fields]));
    // fields_limit bounds unique (value, level) tuples, not field values alone. Scaling it by
    // the level buckets a value can split into keeps room for FIELD_HITS_LIMIT distinct values
    const target = {
      ...buildFieldHitsQuery({ ...query, expr: withLevelPipes(query.expr, grouping) }, range, hitsFields),
      fieldsLimit: FIELD_HITS_LIMIT * (grouping.pipes ? DERIVED_LEVEL_VALUE_COUNT : RAW_LEVEL_BUCKETS),
    };
    const request = buildDrilldownRequest([target], range, `drilldown-hits-${field}`);
    const subscription = runDrilldownQuery(datasource, request, {
      onError: (errors) => {
        // drop the previous result, otherwise consumers keep rendering groups that belong to
        // an older request as if they were the answer to this one
        setGroups([]);
        setTotalValues(0);
        setServerTruncated(false);
        setError(toErrorText(errors));
        setLoading(false);
      },
      onFrames: (frames) => {
        const grouped = groupHitsByFieldValue(frames, field);
        setGroups(grouped.top);
        setTotalValues(grouped.totalValues);
        setServerTruncated(grouped.serverTruncated);
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, query.expr, filtersKey, field, range.from.valueOf(), range.to.valueOf()]);

  return { groups, totalValues, loading, error, serverTruncated };
}

/** The field's top values with their level-stacked volumes */
export function useFieldValuesHits(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string | undefined,
  range: TimeRange
): { top: FieldValueVolume[]; totalValues: number; loading: boolean; error?: string; serverTruncated: boolean } {
  const { groups, totalValues, loading, error, serverTruncated } = useFieldValueFrames(datasource, query, field, range);

  const rangeKey = `${range.from.valueOf()}-${range.to.valueOf()}`;
  const top = useMemo<FieldValueVolume[]>(() => {
    // the aggregation reads only the range from the request, so the target list stays empty
    const request = buildDrilldownRequest([], range, 'drilldown-field-values-aggregate');
    // the same rules the server-side grouping was built from, so drafts never reach the client matcher
    const rules = getDrilldownLevelRules(datasource);
    return groups.map(({ value, total, frames }) => ({
      value,
      total,
      volumeData: {
        // the same level grouping and coloring the main logs-volume path uses, with the
        // narrower row-chart bucket count so the grid matches the query's own step
        series: aggregateRawLogsVolume(frames, extractLevel, request, rules, DRILLDOWN_ROW_BARS),
        state: LoadingState.Done,
        timeRange: range,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, datasource, rangeKey]);

  return { top, totalValues, loading, error, serverTruncated };
}

/** One series per value for a breakdown card chart. Idle until `enabled` */
export function useFieldVolume(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string,
  range: TimeRange,
  enabled: boolean
): PanelData {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });

  // adHocFilters is a new array on every render, so the effect keys off its contents instead
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, state: LoadingState.Loading }));
    // the card chart shows the same top values as the facets summary, one series each
    const target = { ...buildFieldHitsQuery(query, range, [field]), fieldsLimit: FACETS_VALUES_LIMIT };
    const request = buildDrilldownRequest([target], range, `drilldown-field-volume-${field}`);
    const subscription = runDrilldownQuery(datasource, request, {
      onError: (errors) => setData({ series: [], state: LoadingState.Error, timeRange: range, errors }),
      onFrames: (frames) => {
        // the hits past fields_limit arrive as one label-less series that belongs to no
        // value. Drop it, because the card already presents itself as a top-N chart
        const labeled = frames
          .filter((frame) =>
            frame.fields.some((f) => f.type === FieldType.number && f.labels && Object.keys(f.labels).length > 0)
          )
          // name each series after the value, so the bottom legend reads as a list of values
          // instead of {field="value"} label pairs
          .map((frame) => ({
            ...frame,
            fields: frame.fields.map((f) =>
              f.type === FieldType.number && f.labels?.[field] !== undefined
                ? { ...f, config: { ...f.config, displayNameFromDS: f.labels[field] || '(empty)' } }
                : f
            ),
          }));
        setData({ series: labeled, state: LoadingState.Done, timeRange: range });
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, enabled, query.expr, filtersKey, field, range.from.valueOf(), range.to.valueOf()]);

  return data;
}

/** Single-series volume for one breakdown row. Idle until `enabled` */
export function useTargetVolume(
  datasource: VictoriaLogsDatasource,
  target: Query,
  range: TimeRange,
  enabled = true
): PanelData {
  const [data, setData] = useState<PanelData>({ series: [], state: LoadingState.NotStarted, timeRange: range });

  // adHocFilters is a new array on every render, so the effect keys off its contents instead
  const filtersKey = JSON.stringify(target.adHocFilters ?? []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, state: LoadingState.Loading }));
    // the refId doubles as the requestId, because it already carries the per-row suffix
    const request = buildDrilldownRequest([target], range, target.refId);
    const subscription = runDrilldownQuery(datasource, request, {
      onError: (errors) => setData({ series: [], state: LoadingState.Error, timeRange: range, errors }),
      onFrames: (frames) => setData({ series: frames, state: LoadingState.Done, timeRange: range }),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, enabled, target.expr, filtersKey, target.refId, range.from.valueOf(), range.to.valueOf()]);

  return data;
}
