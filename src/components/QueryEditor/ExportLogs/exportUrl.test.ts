import { buildExportUrl } from './exportUrl';

const parse = (exportUrl: string) => {
  const [path, search] = exportUrl.split('?');
  return { path, params: new URLSearchParams(search) };
};

describe('buildExportUrl', () => {
  it('points at the export resource of the datasource with a relative URL', () => {
    const { path } = parse(
      buildExportUrl({ datasourceUid: 'vl uid', orgId: 1, exportQuery: { expr: '*' }, startMs: 1, endMs: 2, format: 'jsonl' })
    );
    expect(path).toBe('api/datasources/uid/vl%20uid/resources/export/logs');
  });

  it('sends the query, the time range in milliseconds, the format, the interval and the filters', () => {
    const exportQuery = {
      expr: 'error AND "a&b=c" | fields _time, _msg',
      intervalMs: 30000,
      extraFilters: '{"level":"error"}',
      extraStreamFilters: '{app="nginx"}',
    };
    const { params } = parse(buildExportUrl({ datasourceUid: 'uid', orgId: 2, exportQuery, startMs: 1000, endMs: 2000, format: 'csv' }));
    expect(Object.fromEntries(params)).toEqual({
      orgId: '2',
      query: exportQuery.expr,
      start: '1000',
      end: '2000',
      format: 'csv',
      interval_ms: '30000',
      extra_filters: exportQuery.extraFilters,
      extra_stream_filters: exportQuery.extraStreamFilters,
    });
  });

  it('omits the interval and the filters that the query does not have', () => {
    const exportQuery = { expr: '*', extraFilters: '', extraStreamFilters: undefined };
    const { params } = parse(buildExportUrl({ datasourceUid: 'uid', orgId: 2, exportQuery, startMs: 1, endMs: 2, format: 'jsonl' }));
    expect(params.has('interval_ms')).toBe(false);
    expect(params.has('extra_filters')).toBe(false);
    expect(params.has('extra_stream_filters')).toBe(false);
  });
});
