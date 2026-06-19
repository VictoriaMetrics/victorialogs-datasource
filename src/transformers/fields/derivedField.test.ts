import { DataFrame, Field, FieldType } from '@grafana/data';

import { PLUGIN_ID } from '../../constants';
import { DerivedFieldConfig } from '../../types';

import { getDerivedFields } from './derivedField';

const getInstanceSettings = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => ({
    getInstanceSettings: (uid: string) => getInstanceSettings(uid),
  }),
}));

function makeLogsFrame(lines: string[]): DataFrame {
  return {
    name: 'logs',
    length: lines.length,
    fields: [
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: lines,
      } as Field,
    ],
  };
}

describe('getDerivedFields', () => {
  beforeEach(() => {
    getInstanceSettings.mockReset();
  });

  it('builds an `expr`-based internal query for a VictoriaLogs target (logs -> logs)', () => {
    getInstanceSettings.mockReturnValue({ type: PLUGIN_ID, name: 'VictoriaLogs' });

    const config: DerivedFieldConfig = {
      name: 'request_id',
      matcherRegex: 'request_id=(\\w+)',
      url: '*:${__value.raw}',
      datasourceUid: 'logs-uid',
    };

    const fields = getDerivedFields(makeLogsFrame(['request_id=abc123']), [config]);
    const internal = fields[0].config.links?.[0].internal;

    expect(internal?.datasourceUid).toBe('logs-uid');
    expect(internal?.query).toEqual({ expr: '*:${__value.raw}', refId: 'A' });
  });

  it('keeps the `query`/`queryType` internal query for a trace target (regression)', () => {
    getInstanceSettings.mockReturnValue({ type: 'tempo', name: 'Tempo' });

    const config: DerivedFieldConfig = {
      name: 'trace_id',
      matcherRegex: 'trace_id=(\\w+)',
      url: '${__value.raw}',
      datasourceUid: 'tempo-uid',
    };

    const fields = getDerivedFields(makeLogsFrame(['trace_id=def456']), [config]);
    const internal = fields[0].config.links?.[0].internal;

    expect(internal?.datasourceUid).toBe('tempo-uid');
    expect(internal?.query).toEqual({ query: '${__value.raw}', queryType: 'traceql' });
  });
});
