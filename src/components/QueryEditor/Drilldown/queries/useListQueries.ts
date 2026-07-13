import { useEffect, useRef, useState } from 'react';

import { DataFrame, TimeRange } from '@grafana/data';

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
import { runDrilldownQuery, toErrorText } from './runDrilldownQuery';

export interface FieldValueListItem {
  value: string;
  total: number;
}

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
      // `_msg` carries the value in the message itself, every other field in the labels
      const value = field === '_msg' ? String(lineField?.values[i] ?? '') : (labels?.[field] ?? '');
      const hits = Number(labels?.hits);
      items.push({ value, total: Number.isFinite(hits) ? hits : 0 });
    });
  }
  // `top` orders rows by hits, but the frames can arrive split, so restore the order here
  return items.sort((a, b) => b.total - a.total);
}

/**
 * Loads the exact top values of one field through `top by (field)`. Do not switch it to the
 * indexed field_values endpoint: past its limit that endpoint returns an arbitrary subset
 * with zeroed hits
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
  // separates a switch to another field from a refetch of the same one
  const previousFieldRef = useRef(field);

  // adHocFilters is a new array on every render, so the effect keys off its contents instead
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    const fieldChanged = previousFieldRef.current !== field;
    previousFieldRef.current = field;
    if (fieldChanged) {
      // clear at once, so the new field never shows rows of the previous one
      setValues([]);
      setServerTruncated(false);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(undefined);
    const target = buildFieldValuesListQuery(query, field);
    const request = buildDrilldownRequest([target], range, target.refId);
    const subscription = runDrilldownQuery(datasource, request, {
      onError: (errors) => {
        setError(toErrorText(errors));
        setLoading(false);
      },
      onFrames: (frames) => {
        const items = parseFieldValuesFrames(frames, field);
        // the query asked for one row past the cap only to detect that more values exist
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

/** One row of the patterns list. The count is the sampled hits scaled back up */
export interface PatternListItem {
  pattern: string;
  approxTotal: number;
}

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
  // `top` orders rows by hits, but the frames can arrive split, so restore the order here
  return items.sort((a, b) => b.approxTotal - a.approxTotal);
}

/** The top patterns with their approximate counts. Idle until `enabled` */
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

  // adHocFilters is a new array on every render, so the effect keys off its contents instead
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setError(undefined);
    // `patterns` stays untouched on purpose. The tab always shows the patterns of the drawer
    // query, so a refetch keeps the previous rows visible until `complete` replaces them
    const target = buildPatternsListQuery(query);
    const request = buildDrilldownRequest([target], range, 'drilldown-patterns-list');
    const subscription = runDrilldownQuery(datasource, request, {
      onError: (errors) => {
        setError(toErrorText(errors));
        setLoading(false);
      },
      onFrames: (frames) => {
        const items = parsePatternsListFrames(frames);
        // the query asked for one row past the cap only to detect that more patterns exist
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
