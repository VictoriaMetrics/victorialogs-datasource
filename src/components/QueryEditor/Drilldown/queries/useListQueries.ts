import { useEffect, useRef, useState } from 'react';
import { from, isObservable } from 'rxjs';

import { DataFrame, TimeRange, toDataFrame } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import {
  buildDrilldownRequest,
  buildFieldValuesListQuery,
  buildPatternsListQuery,
  FIELD_VALUES_LIMIT,
  PATTERNS_LIMIT,
  PATTERNS_SAMPLE_FACTOR,
} from './drilldownQueries';
import { errorMessage } from './errorMessage';

/** One row of the field-values table; counts from field_values are exact */
export interface FieldValueListItem {
  value: string;
  total: number;
}

/** Extracts {value, hits} rows from the frames of the `top by (field)` list query */
function parseFieldValuesFrames(frames: DataFrame[], field: string): FieldValueListItem[] {
  const items: FieldValueListItem[] = [];
  for (const frame of frames) {
    const lineField = frame.fields.find((f) => f.name === 'Line');
    const labelsField = frame.fields.find((f) => f.name === 'labels');
    if (!labelsField) {
      continue;
    }
    labelsField.values.forEach((rowLabels: unknown, i: number) => {
      const labels = rowLabels as Record<string, string> | undefined;
      // for `_msg` the value lands in the message itself; for any other field — in the labels
      const value = field === '_msg' ? String(lineField?.values[i] ?? '') : (labels?.[field] ?? '');
      const hits = Number(labels?.hits);
      items.push({ value, total: Number.isFinite(hits) ? hits : 0 });
    });
  }
  // `top` returns rows ordered by hits, but frames may arrive split — restore the order
  return items.sort((a, b) => b.total - a.total);
}

/**
 * Loads the exact top values of one field via `top by (field)`. The indexed field_values
 * endpoint is NOT used — past its limit it returns an arbitrary subset with zeroed hits
 */
export function useFieldValuesList(
  datasource: VictoriaLogsDatasource,
  query: Query,
  field: string,
  range: TimeRange
): { values: FieldValueListItem[]; loading: boolean; error?: string; serverTruncated: boolean } {
  const [values, setValues] = useState<FieldValueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [serverTruncated, setServerTruncated] = useState(false);
  // tells a content-identity change (another field) apart from a context-only refetch
  const previousFieldRef = useRef(field);

  // adHocFilters is a new array/object on every render even when its contents are unchanged —
  // a stable string key is needed so the effect only re-runs when the filters actually change
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    const fieldChanged = previousFieldRef.current !== field;
    previousFieldRef.current = field;
    if (fieldChanged) {
      // a different field must never show rows of the previous one

      setValues([]);
      setServerTruncated(false);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(undefined);
    const target = buildFieldValuesListQuery(query, field);
    const request = buildDrilldownRequest([target], range, target.refId);
    const response = datasource.query(request);
    const observable = isObservable(response) ? response : from(Promise.resolve(response));
    let frames: DataFrame[] = [];
    let hadError = false;
    const subscription = observable.subscribe({
      next: (resp) => {
        // datasource.query() can deliver a per-query error in-band on a next-emission
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
        const items = parseFieldValuesFrames(frames, field);
        // the extra row requested beyond the cap only signals that more values exist
        setServerTruncated(items.length > FIELD_VALUES_LIMIT);
        setValues(items.slice(0, FIELD_VALUES_LIMIT));
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, query.expr, filtersKey, field, range.from.valueOf(), range.to.valueOf()]);

  return { values, loading, error, serverTruncated };
}

/** One row of the fast patterns list; the count is approximate (scaled back from the sampled query) */
export interface PatternListItem {
  pattern: string;
  approxTotal: number;
}

/** Extracts {pattern, approxHits} rows from the frames of the `top by (_msg)` list query */
function parsePatternsListFrames(frames: DataFrame[]): PatternListItem[] {
  const items: PatternListItem[] = [];
  for (const frame of frames) {
    const lineField = frame.fields.find((f) => f.name === 'Line');
    const labelsField = frame.fields.find((f) => f.name === 'labels');
    if (!lineField || !labelsField) {
      continue;
    }
    lineField.values.forEach((line: unknown, i: number) => {
      const labels = labelsField.values[i] as Record<string, string> | undefined;
      const hits = Number(labels?.hits);
      items.push({
        pattern: String(line ?? ''),
        approxTotal: (Number.isFinite(hits) ? hits : 0) * PATTERNS_SAMPLE_FACTOR,
      });
    });
  }
  // `top` returns rows ordered by hits, but frames may arrive split — restore the order
  return items.sort((a, b) => b.approxTotal - a.approxTotal);
}

/** Runs the sampled patterns-list query (collapse_nums + top) and returns the top patterns with approximate counts; idle until enabled */
export function usePatternsList(
  datasource: VictoriaLogsDatasource,
  query: Query,
  range: TimeRange,
  enabled: boolean
): { patterns: PatternListItem[]; totalPatterns: number; loading: boolean; error?: string; serverTruncated: boolean } {
  const [patterns, setPatterns] = useState<PatternListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [serverTruncated, setServerTruncated] = useState(false);

  // adHocFilters is a new array/object on every render even when its contents are unchanged —
  // a stable string key is needed so the effect only re-runs when the filters actually change
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setError(undefined);
    // `patterns` is intentionally left untouched here — the patterns tab has no content identity
    // of its own (it always covers "patterns of the drawer query"), so a context-only refetch
    // (range/filters/expr changed) keeps the previous rows visible until `complete` replaces them
    const target = buildPatternsListQuery(query);
    const request = buildDrilldownRequest([target], range, 'drilldown-patterns-list');
    const response = datasource.query(request);
    const observable = isObservable(response) ? response : from(Promise.resolve(response));
    let frames: DataFrame[] = [];
    let hadError = false;
    const subscription = observable.subscribe({
      next: (resp) => {
        // see useFieldValuesHits — datasource.query() can deliver a per-query error in-band
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
        const items = parsePatternsListFrames(frames);
        // the list query asks for one row beyond the display cap purely to detect truncation
        setServerTruncated(items.length > PATTERNS_LIMIT);
        setPatterns(items.slice(0, PATTERNS_LIMIT));
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, query.expr, filtersKey, enabled, range.from.valueOf(), range.to.valueOf()]);

  return { patterns, totalPatterns: patterns.length, loading, error, serverTruncated };
}
