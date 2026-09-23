import { of } from 'rxjs';

import { dateTime, TimeRange, toDataFrame } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query, QueryType, SupportingQueryType } from '../../../../types';

/** Shared fixtures for the drilldown query-hook tests */

export const range: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

export const query: Query = { refId: 'A', expr: 'error' };

/** Spacing of the fixture buckets. It keeps a few samples well inside the one-hour `range` */
const FIXTURE_STEP_MS = 60_000;

/** Epoch-ms bucket timestamps inside `range`, one per value */
const fixtureTimes = (values: number[]) => values.map((_, i) => range.from.valueOf() + i * FIXTURE_STEP_MS);

export const makeHitsFrame = (level: string, values: number[]) =>
  toDataFrame({
    fields: [
      { name: 'Time', values: fixtureTimes(values) },
      { name: 'Value', values, labels: { level } },
    ],
  });

export const makeLabeledFrame = (labels: Record<string, string>, values: number[]) =>
  toDataFrame({
    fields: [
      { name: 'Time', values: fixtureTimes(values) },
      { name: 'Value', values, labels },
    ],
  });

export const makeDatasource = (overrides: Partial<VictoriaLogsDatasource> = {}) =>
  ({
    logLevelRules: [],
    getActiveLevelRules: jest.fn().mockReturnValue([]),
    customQueryParameters: new URLSearchParams(),
    interpolateString: jest.fn((s: string) => s),
    languageProvider: {
      getFieldList: jest.fn().mockResolvedValue([
        { value: 'level', hits: 1 },
        { value: 'app', hits: 1 },
      ]),
      getStreamFieldList: jest.fn().mockResolvedValue([]),
    },
    getSupplementaryQuery: jest.fn().mockReturnValue({
      ...query,
      queryType: QueryType.Hits,
      fields: ['level'],
      supportingQueryType: SupportingQueryType.LogsVolume,
    }),
    query: jest.fn().mockReturnValue(of({ data: [makeHitsFrame('error', [10]), makeHitsFrame('info', [1])] })),
    ...overrides,
  }) as unknown as VictoriaLogsDatasource;

/** A facets response with one field holding one value */
export const facetsResponse = { facets: [{ field_name: 'app', values: [{ field_value: 'web', hits: 3 }] }] };

/** A datasource whose facets endpoint answers with `facetsResponse` unless `postResource` says otherwise */
export const makeFacetsDatasource = ({
  postResource = jest.fn().mockResolvedValue(facetsResponse),
  customQueryParameters = new URLSearchParams(),
}: { postResource?: jest.Mock; customQueryParameters?: URLSearchParams } = {}) =>
  makeDatasource({ customQueryParameters, postResource } as unknown as Partial<VictoriaLogsDatasource>);
