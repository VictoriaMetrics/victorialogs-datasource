import { LogRowContextQueryDirection, LogRowModel } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

// eslint-disable-next-line jest/no-mocks-import
import { createDatasource } from '../__mocks__/datasource';

import { LogContextProvider } from './LogContextProvider';

const replaceMock = jest.fn().mockImplementation((a: string) => a);
const templateSrvStub = {
  replace: replaceMock,
  getVariables: jest.fn().mockReturnValue([]),
} as unknown as TemplateSrv;

describe('LogContextProvider', () => {
  let provider: LogContextProvider;

  beforeEach(() => {
    provider = createDatasource(templateSrvStub).logContextProvider;
  });

  // builds a logs frame carrying the hidden per-row `streams`/`streamId` fields
  const buildFrame = (streamIds: string[], streams: Array<Record<string, string> | null>) => ({
    refId: 'A',
    fields: [
      { name: 'streams', values: streams },
      { name: 'streamId', values: streamIds },
    ],
    length: streams.length,
  });

  const buildLogRow = (overrides?: object): LogRowModel =>
    ({
      rowIndex: 0,
      dataFrame: buildFrame(['stream-id-1'], [{ app: 'nginx', host: 'h-1' }]),
      labels: {},
      timeEpochMs: 1700000000000,
      timeEpochNs: '1700000000000123456',
      ...overrides,
    }) as unknown as LogRowModel;

  it('builds context query by _stream_id when all stream labels are enabled', async () => {
    const query = await provider.getLogRowContextQuery(buildLogRow());
    expect(query?.expr).toBe('_stream_id:"stream-id-1" _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });

  it('uses ascending sort for the forward direction', async () => {
    const query = await provider.getLogRowContextQuery(buildLogRow(), {
      direction: LogRowContextQueryDirection.Forward,
    });
    expect(query?.expr).toBe('_stream_id:"stream-id-1" _time:>2023-11-14T22:13:20.000123456Z | sort by (_time) asc limit 50');
  });

  it('builds a _stream selector from enabled labels when some are toggled off', async () => {
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(buildLogRow());
    expect(query?.expr).toBe('_stream:{app="nginx"} _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });

  it('escapes quotes and backslashes in stream label values', async () => {
    const row = buildLogRow({
      dataFrame: buildFrame(['stream-id-1'], [{ app: 'a"b', host: 'h-1' }]),
    });
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(row);
    expect(query?.expr).toBe('_stream:{app="a\\"b"} _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });

  it('quotes stream label keys that are not simple identifiers', async () => {
    const row = buildLogRow({
      dataFrame: buildFrame(['stream-id-1'], [{ 'Dino Species': 'Stegosaurus', host: 'h-1' }]),
    });
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(row);
    expect(query?.expr).toBe('_stream:{"Dino Species"="Stegosaurus"} _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });

  it('falls back to _stream_id when the label is toggled back on', async () => {
    provider.toggleStreamLabel('stream-id-1', 'host');
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(buildLogRow());
    expect(query?.expr).toBe('_stream_id:"stream-id-1" _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });

  it('falls back to _stream_id when every label is toggled off', async () => {
    provider.toggleStreamLabel('stream-id-1', 'app');
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(buildLogRow());
    expect(query?.expr).toBe('_stream_id:"stream-id-1" _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });

  it('treats a null _stream (field absent) as no stream labels', () => {
    const row = buildLogRow({
      dataFrame: buildFrame(['stream-id-1'], [null]),
    });
    expect(provider.getStreamLabels(row)).toEqual({});
    // still has a _stream_id, so context can be shown
    expect(provider.hasContextData(row)).toBe(true);
  });

  it('builds context by _stream labels when _stream_id is missing', async () => {
    const row = buildLogRow({
      dataFrame: buildFrame([''], [{ app: 'nginx', host: 'h-1' }]),
    });
    const query = await provider.getLogRowContextQuery(row);
    expect(query?.expr).toBe('_stream:{app="nginx",host="h-1"} _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });

  it('narrows the _stream selector by enabled labels when _stream_id is missing', async () => {
    const row = buildLogRow({
      dataFrame: buildFrame([''], [{ app: 'nginx', host: 'h-1' }]),
    });
    // with no _stream_id the toggle state is keyed by an empty stream id
    provider.toggleStreamLabel('', 'host');
    const query = await provider.getLogRowContextQuery(row);
    expect(query?.expr).toBe('_stream:{app="nginx"} _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });

  it('reports no context data when both _stream and _stream_id are missing', () => {
    const row = buildLogRow({
      dataFrame: buildFrame([''], [null]),
    });
    expect(provider.hasContextData(row)).toBe(false);
  });

  it('reports no context data when the frame carries no stream fields at all', () => {
    const row = buildLogRow({
      dataFrame: { refId: 'A', fields: [], length: 1 },
    });
    expect(provider.hasContextData(row)).toBe(false);
  });

  // both direction queries used to cover [anchor, anchor + 1s], so every line in that
  // window was fetched twice and shown twice in the "Show context" modal (issue #692).
  // The queries must split the timeline at the anchor timestamp without overlap:
  // backward covers (-inf, anchor], forward covers (anchor, +inf)
  describe('context query time boundaries', () => {
    it('bounds the backward query at the anchor timestamp inclusively', async () => {
      const query = await provider.getLogRowContextQuery(buildLogRow(), {
        direction: LogRowContextQueryDirection.Backward,
      });
      expect(query?.expr).toBe(
        '_stream_id:"stream-id-1" _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50'
      );
    });

    it('bounds the forward query strictly after the anchor timestamp', async () => {
      const query = await provider.getLogRowContextQuery(buildLogRow(), {
        direction: LogRowContextQueryDirection.Forward,
      });
      expect(query?.expr).toBe(
        '_stream_id:"stream-id-1" _time:>2023-11-14T22:13:20.000123456Z | sort by (_time) asc limit 50'
      );
    });

    it('falls back to millisecond precision when the row has no nanosecond timestamp', async () => {
      const query = await provider.getLogRowContextQuery(buildLogRow({ timeEpochNs: undefined }), {
        direction: LogRowContextQueryDirection.Backward,
      });
      expect(query?.expr).toBe(
        '_stream_id:"stream-id-1" _time:<=2023-11-14T22:13:20.000000000Z | sort by (_time) desc limit 50'
      );
    });
  });

  describe('context query row limit', () => {
    it('caps rows at the limit requested by the context modal', async () => {
      const query = await provider.getLogRowContextQuery(buildLogRow(), {
        direction: LogRowContextQueryDirection.Backward,
        limit: 42,
      });
      expect(query?.expr).toBe(
        '_stream_id:"stream-id-1" _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 42'
      );
    });

    it('falls back to the default limit when the modal does not pass one', async () => {
      const query = await provider.getLogRowContextQuery(buildLogRow());
      expect(query?.expr).toBe(
        '_stream_id:"stream-id-1" _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50'
      );
    });
  });

  it('keeps toggle state isolated between different streams', async () => {
    const otherStreamRow = buildLogRow({
      dataFrame: buildFrame(['stream-id-2'], [{ app: 'nginx', host: 'h-2' }]),
    });
    provider.toggleStreamLabel('stream-id-1', 'host');

    const query = await provider.getLogRowContextQuery(otherStreamRow);

    expect(query?.expr).toBe('_stream_id:"stream-id-2" _time:<=2023-11-14T22:13:20.000123456Z | sort by (_time) desc limit 50');
  });
});
