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

  const buildLogRow = (overrides?: object): LogRowModel =>
    ({
      rowIndex: 0,
      dataFrame: {
        refId: 'A',
        fields: [],
        length: 1,
        meta: {
          custom: {
            streamIds: ['stream-id-1'],
            streams: [{ app: 'nginx', host: 'h-1' }],
          },
        },
      },
      labels: {},
      timeEpochMs: 1700000000000,
      ...overrides,
    }) as unknown as LogRowModel;

  it('builds context query by _stream_id when all stream labels are enabled', async () => {
    const query = await provider.getLogRowContextQuery(buildLogRow());
    expect(query?.expr).toBe('_stream_id:"stream-id-1" | sort by (_time) desc');
  });

  it('uses ascending sort for the forward direction', async () => {
    const query = await provider.getLogRowContextQuery(buildLogRow(), {
      direction: LogRowContextQueryDirection.Forward,
    });
    expect(query?.expr).toBe('_stream_id:"stream-id-1" | sort by (_time) asc');
  });

  it('builds a _stream selector from enabled labels when some are toggled off', async () => {
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(buildLogRow());
    expect(query?.expr).toBe('_stream:{app="nginx"} | sort by (_time) desc');
  });

  it('escapes quotes and backslashes in stream label values', async () => {
    const row = buildLogRow({
      dataFrame: {
        refId: 'A',
        fields: [],
        length: 1,
        meta: { custom: { streamIds: ['stream-id-1'], streams: [{ app: 'a"b', host: 'h-1' }] } },
      },
    });
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(row);
    expect(query?.expr).toBe('_stream:{app="a\\"b"} | sort by (_time) desc');
  });

  it('quotes stream label keys that are not simple identifiers', async () => {
    const row = buildLogRow({
      dataFrame: {
        refId: 'A',
        fields: [],
        length: 1,
        meta: {
          custom: { streamIds: ['stream-id-1'], streams: [{ 'Dino Species': 'Stegosaurus', host: 'h-1' }] },
        },
      },
    });
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(row);
    expect(query?.expr).toBe('_stream:{"Dino Species"="Stegosaurus"} | sort by (_time) desc');
  });

  it('falls back to _stream_id when the label is toggled back on', async () => {
    provider.toggleStreamLabel('stream-id-1', 'host');
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(buildLogRow());
    expect(query?.expr).toBe('_stream_id:"stream-id-1" | sort by (_time) desc');
  });

  it('falls back to _stream_id when every label is toggled off', async () => {
    provider.toggleStreamLabel('stream-id-1', 'app');
    provider.toggleStreamLabel('stream-id-1', 'host');
    const query = await provider.getLogRowContextQuery(buildLogRow());
    expect(query?.expr).toBe('_stream_id:"stream-id-1" | sort by (_time) desc');
  });

  it('keeps toggle state isolated between different streams', async () => {
    const otherStreamRow = buildLogRow({
      dataFrame: {
        refId: 'A',
        fields: [],
        length: 1,
        meta: { custom: { streamIds: ['stream-id-2'], streams: [{ app: 'nginx', host: 'h-2' }] } },
      },
    });
    provider.toggleStreamLabel('stream-id-1', 'host');

    const query = await provider.getLogRowContextQuery(otherStreamRow);

    expect(query?.expr).toBe('_stream_id:"stream-id-2" | sort by (_time) desc');
  });
});
