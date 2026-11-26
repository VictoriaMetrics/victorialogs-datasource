import { buildExportUrl, exportFileName } from './exportUrl';

const parse = (exportUrl: string) => {
  const [path, search] = exportUrl.split('?');
  return { path, params: new URLSearchParams(search) };
};

describe('buildExportUrl', () => {
  it('points at the export resource of the datasource with a relative URL', () => {
    const { path } = parse(
      buildExportUrl({ datasourceUid: 'vl uid', exportQuery: { expr: '*' }, startMs: 1, endMs: 2, format: 'jsonl' })
    );
    expect(path).toBe('api/datasources/uid/vl%20uid/resources/export/logs');
  });

  it('sends the query, the time range in milliseconds, the format and the filters', () => {
    const exportQuery = {
      expr: 'error AND "a&b=c" | fields _time, _msg',
      extraFilters: '{"level":"error"}',
      extraStreamFilters: '{app="nginx"}',
    };
    const { params } = parse(buildExportUrl({ datasourceUid: 'uid', exportQuery, startMs: 1000, endMs: 2000, format: 'csv' }));
    expect(Object.fromEntries(params)).toEqual({
      query: exportQuery.expr,
      start: '1000',
      end: '2000',
      format: 'csv',
      extra_filters: exportQuery.extraFilters,
      extra_stream_filters: exportQuery.extraStreamFilters,
    });
  });

  it('omits the filters that the query does not have', () => {
    const exportQuery = { expr: '*', extraFilters: '', extraStreamFilters: undefined };
    const { params } = parse(buildExportUrl({ datasourceUid: 'uid', exportQuery, startMs: 1, endMs: 2, format: 'jsonl' }));
    expect(params.has('extra_filters')).toBe(false);
    expect(params.has('extra_stream_filters')).toBe(false);
  });
});

describe('exportFileName', () => {
  it('names the file by the time and the format', () => {
    expect(exportFileName('jsonl', 1700000000000)).toBe('export-1700000000000.jsonl');
    expect(exportFileName('csv', 1700000000000)).toBe('export-1700000000000.csv');
  });
});
