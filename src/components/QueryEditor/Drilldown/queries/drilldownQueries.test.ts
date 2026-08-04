import { dateTime, LogLevel, toDataFrame, TimeRange } from '@grafana/data';

import { LogLevelRuleType } from '../../../../configuration/LogLevelRules/types';
import { VictoriaLogsDatasource } from '../../../../datasource';
import { escapeLabelValueInSelector } from '../../../../languageUtils';
import { addLabelToQuery } from '../../../../modifyQuery';
import { AdHocFilter, Query, QueryType } from '../../../../types';
import { buildLevelGrouping, DERIVED_LEVEL_FIELD, LevelGrouping } from '../../../../utils/query/levelFormatPipes';

import {
  buildFieldHitsQuery,
  buildFieldPresenceLogsQuery,
  buildFieldPresenceVolumeQuery,
  buildLookupQuery,
  buildPatternLogsQuery,
  buildPatternsListQuery,
  buildPatternVolumeQuery,
  buildValueLogsQuery,
  FIELD_HITS_LIMIT,
  groupHitsByFieldValue,
  PATTERNS_LIMIT,
  PATTERNS_SAMPLE_FACTOR,
} from './drilldownQueries';

const range: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

const baseQuery: Query = { refId: 'A', expr: 'error' };

/** No active rules: the lightweight raw `level` split, no format pipes */
const rawLevelGrouping: LevelGrouping = { pipes: '', fields: ['level'] };
const rules = [{ field: 'severity', operator: LogLevelRuleType.Equals, value: 'err', level: LogLevel.error, enabled: true }];

describe('buildLookupQuery', () => {
  const lookupDatasource = {
    interpolateString: (s: string) => s,
    getActiveLevelRules: () => [],
  } as unknown as VictoriaLogsDatasource;

  it('returns * when there are no filters', () => {
    expect(buildLookupQuery(lookupDatasource, [], [])).toBe('*');
  });

  it('serializes plain chips literally', () => {
    const filters: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'web' }];
    expect(buildLookupQuery(lookupDatasource, filters, [])).toBe('app:="web"');
  });

  it('expands level-button chips into the exact per-level expression', () => {
    const filters: AdHocFilter[] = [{ key: 'level', operator: '=', value: 'error', fromLevelFilter: true }];
    const result = buildLookupQuery(lookupDatasource, filters, []);
    // derived-level semantics: alias expansion instead of a literal `level:="error"` match
    expect(result).toContain('level:contains_common_case(');
    expect(result).not.toContain('level:="error"');
  });

  it('drops filters on the excluded key, including level-button chips', () => {
    const filters: AdHocFilter[] = [
      { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      { key: 'app', operator: '=', value: 'web' },
    ];
    expect(buildLookupQuery(lookupDatasource, filters, [], 'level')).toBe('app:="web"');
  });
});

describe('buildFieldHitsQuery', () => {
  it('builds a hits query grouped by the given fields', () => {
    const result = buildFieldHitsQuery(baseQuery, range, ['level', 'severity']);
    expect(result.queryType).toBe(QueryType.Hits);
    expect(result.fields).toEqual(['level', 'severity']);
    expect(result.step).toBe('72s');
    expect(result.hide).toBe(false);
    expect(result.refId).toBe('drilldown-hits-level');
    expect(result.fieldsLimit).toBe(FIELD_HITS_LIMIT);
  });
});

describe('buildPatternsListQuery', () => {
  it('builds a sampled instant top query over collapsed messages', () => {
    const result = buildPatternsListQuery(baseQuery);
    expect(result.expr).toBe(
      `error | sample ${PATTERNS_SAMPLE_FACTOR} | collapse_nums prettify | top ${PATTERNS_LIMIT + 1} by (_msg)`
    );
    expect(result.queryType).toBe(QueryType.Instant);
    expect(result.maxLines).toBe(PATTERNS_LIMIT + 1);
    expect(result.hide).toBe(false);
    expect(result.refId).toBe('drilldown-patterns-list');
  });
});

describe('buildPatternVolumeQuery', () => {
  it('builds a single-series hits query filtered by the pattern', () => {
    const result = buildPatternVolumeQuery(baseQuery, 'demo <N>', range, 2);
    expect(result.expr).toBe('error | filter pattern_match_full("demo <N>")');
    expect(result.queryType).toBe(QueryType.Hits);
    expect(result.fields).toEqual([]);
    expect(result.step).toBe('72s');
    expect(result.refId).toBe('drilldown-pattern-volume-2');
  });

  it('escapes special characters in the pattern', () => {
    const result = buildPatternVolumeQuery(baseQuery, 'he said "hi"', range, 0);
    const escaped = escapeLabelValueInSelector('he said "hi"');
    expect(result.expr).toContain(`pattern_match_full("${escaped}")`);
  });
});

describe('buildPatternLogsQuery', () => {
  it('filters by the collapsed pattern via pattern_match_full', () => {
    const result = buildPatternLogsQuery(baseQuery, 'demo message <N> level=info', 2);
    expect(result.expr).toBe(
      'error | filter pattern_match_full("demo message <N> level=info") | sort by (_time) desc'
    );
    expect(result.queryType).toBe(QueryType.Instant);
    expect(result.maxLines).toBe(50);
    expect(result.refId).toBe('drilldown-pattern-logs-2');
  });

  it('escapes special characters in the pattern', () => {
    const result = buildPatternLogsQuery(baseQuery, 'he said "hi"', 0);
    const escaped = escapeLabelValueInSelector('he said "hi"');
    expect(result.expr).toContain(`filter pattern_match_full("${escaped}")`);
  });
});

describe('buildFieldPresenceVolumeQuery', () => {
  it('builds a hits query narrowed to the logs carrying the field, split by the raw level without rules', () => {
    const result = buildFieldPresenceVolumeQuery(baseQuery, 'namespace', rawLevelGrouping, range, 4);
    expect(result.expr).toBe('error AND namespace:*');
    expect(result.queryType).toBe(QueryType.Hits);
    expect(result.fields).toEqual(['level']);
    expect(result.fieldsLimit).toBe(FIELD_HITS_LIMIT);
    expect(result.step).toBe('72s');
    expect(result.hide).toBe(false);
    expect(result.refId).toBe('drilldown-field-presence-volume-4');
  });

  it('inserts the presence filter before the pipes', () => {
    const query: Query = { refId: 'A', expr: 'error | collapse_nums' };
    const result = buildFieldPresenceVolumeQuery(query, 'pod', rawLevelGrouping, range, 0);
    expect(result.expr).toBe('error AND pod:* | collapse_nums');
  });

  it('quotes field names containing special characters', () => {
    const result = buildFieldPresenceVolumeQuery(baseQuery, 'kubernetes:pod', rawLevelGrouping, range, 0);
    expect(result.expr).toBe('error AND "kubernetes:pod":*');
  });

  it('derives the level server-side with active rules: format pipes in the expr, hits grouped by the derived field', () => {
    const grouping = buildLevelGrouping(rules);
    const result = buildFieldPresenceVolumeQuery(baseQuery, 'namespace', grouping, range, 0);
    expect(result.fields).toEqual([DERIVED_LEVEL_FIELD]);
    expect(result.expr).toContain('error AND namespace:*');
    expect(result.expr).toContain(`format "" as ${DERIVED_LEVEL_FIELD}`);
  });
});

describe('buildFieldPresenceLogsQuery', () => {
  it('builds an instant sample query for the logs carrying the field', () => {
    const result = buildFieldPresenceLogsQuery(baseQuery, 'namespace', 3);
    expect(result.expr).toBe('error AND namespace:* | sort by (_time) desc');
    expect(result.queryType).toBe(QueryType.Instant);
    expect(result.maxLines).toBe(50);
    expect(result.hide).toBe(false);
    expect(result.refId).toBe('drilldown-field-logs-3');
  });
});

describe('buildValueLogsQuery', () => {
  it('builds an instant query narrowed to the field value with a sample limit', () => {
    const result = buildValueLogsQuery({ refId: 'A', expr: '*' }, 'level', 'error', 3);
    expect(result.queryType).toBe(QueryType.Instant);
    expect(result.expr).toBe(`${addLabelToQuery('*', { key: 'level', value: 'error', operator: '=' })} | sort by (_time) desc`);
    expect(result.maxLines).toBe(50);
    expect(result.hide).toBe(false);
    expect(result.refId).toBe('drilldown-logs-3');
  });

  it('escapes special characters in the value', () => {
    const result = buildValueLogsQuery({ refId: 'A', expr: '*' }, 'app', 'he"llo', 0);
    const escaped = escapeLabelValueInSelector('he"llo');
    expect(result.expr).toBe(`${addLabelToQuery('*', { key: 'app', value: escaped, operator: '=' })} | sort by (_time) desc`);
  });
});

describe('groupHitsByFieldValue', () => {
  const makeFrame = (labels: Record<string, string>, values: number[]) =>
    toDataFrame({
      fields: [
        { name: 'Time', values: values.map((_, i) => i) },
        { name: 'Value', values, labels },
      ],
    });

  it('groups level-split frames by the field value and sums totals', () => {
    const frames = [
      makeFrame({ app: 'web', level: 'error' }, [10]),
      makeFrame({ app: 'web', level: 'info' }, [5]),
      makeFrame({ app: 'api', level: 'info' }, [7]),
    ];
    const { top, totalValues } = groupHitsByFieldValue(frames, 'app');
    expect(totalValues).toBe(2);
    expect(top[0]).toMatchObject({ value: 'web', total: 15 });
    expect(top[0].frames).toHaveLength(2);
    expect(top[1]).toMatchObject({ value: 'api', total: 7 });
  });

  it('limits the result and reports the pre-cut count', () => {
    const frames = [makeFrame({ app: 'a' }, [3]), makeFrame({ app: 'b' }, [2]), makeFrame({ app: 'c' }, [1])];
    const { top, totalValues } = groupHitsByFieldValue(frames, 'app', 2);
    expect(top.map((t) => t.value)).toEqual(['a', 'b']);
    expect(totalValues).toBe(3);
  });

  it('skips frames without the field label', () => {
    const frames = [makeFrame({ level: 'error' }, [5]), makeFrame({ app: 'web' }, [1])];
    const { top } = groupHitsByFieldValue(frames, 'app');
    expect(top.map((t) => t.value)).toEqual(['web']);
  });

  it('does not report serverTruncated for ordinary frames', () => {
    const frames = [makeFrame({ app: 'web' }, [1]), makeFrame({ level: 'error' }, [5])];
    const { serverTruncated } = groupHitsByFieldValue(frames, 'app');
    expect(serverTruncated).toBe(false);
  });

  it('reports serverTruncated when a frame carries no labels at all — the fields_limit remainder series', () => {
    const frames = [makeFrame({ app: 'web' }, [1]), makeFrame({}, [99])];
    const { top, serverTruncated } = groupHitsByFieldValue(frames, 'app');
    expect(serverTruncated).toBe(true);
    // the remainder series' hits aren't attributed to any value
    expect(top.map((t) => t.value)).toEqual(['web']);
  });
});
