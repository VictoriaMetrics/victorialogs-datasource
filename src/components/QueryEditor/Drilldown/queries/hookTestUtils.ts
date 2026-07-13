import { of } from 'rxjs';

import { dateTime, TimeRange, toDataFrame } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query, QueryType, SupportingQueryType } from '../../../../types';

/** Shared fixtures for the drilldown query-hook tests (useFieldListQueries/useListQueries/useVolumeQueries/useLogsSampleQueries) */

export const range: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

export const query: Query = { refId: 'A', expr: 'error' };

export const makeHitsFrame = (level: string, values: number[]) =>
  toDataFrame({
    fields: [
      { name: 'Time', values: values.map((_, i) => i) },
      { name: 'Value', values, labels: { level } },
    ],
  });

export const makeLabeledFrame = (labels: Record<string, string>, values: number[]) =>
  toDataFrame({
    fields: [
      { name: 'Time', values: values.map((_, i) => i) },
      { name: 'Value', values, labels },
    ],
  });

export const makeDatasource = (overrides: Partial<VictoriaLogsDatasource> = {}) =>
  ({
    logLevelRules: [],
    getActiveLevelRules: jest.fn().mockReturnValue([]),
    customQueryParameters: new URLSearchParams(),
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
