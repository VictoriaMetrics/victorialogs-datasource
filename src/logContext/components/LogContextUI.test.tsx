import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { LogRowModel } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

// eslint-disable-next-line jest/no-mocks-import
import { createDatasource } from '../../__mocks__/datasource';

import { LogContextUI } from './LogContextUI';

const templateSrvStub = {
  replace: jest.fn().mockImplementation((a: string) => a),
  getVariables: jest.fn().mockReturnValue([]),
} as unknown as TemplateSrv;

const buildLogRow = (streams: Array<Record<string, string>> = [{ app: 'nginx', host: 'h-1' }]): LogRowModel =>
  ({
    rowIndex: 0,
    dataFrame: {
      refId: 'A',
      fields: [
        { name: 'streams', values: streams },
        { name: 'streamId', values: ['stream-id-1'] },
      ],
      length: 1,
    },
    labels: {},
    timeEpochMs: 1700000000000,
  }) as unknown as LogRowModel;

describe('LogContextUi', () => {
  let ds: ReturnType<typeof createDatasource>;

  beforeEach(() => {
    ds = createDatasource(templateSrvStub);
  });

  it('renders a pill per stream label', () => {
    render(<LogContextUI provider={ds.logContextProvider} row={buildLogRow()} runContextQuery={jest.fn()} />);
    expect(screen.getByText('app="nginx"')).toBeInTheDocument();
    expect(screen.getByText('host="h-1"')).toBeInTheDocument();
  });

  it('toggles a label off and reruns the context query', () => {
    const runContextQuery = jest.fn();
    render(<LogContextUI provider={ds.logContextProvider} row={buildLogRow()} runContextQuery={runContextQuery} />);

    fireEvent.click(screen.getByText('host="h-1"'));

    expect(ds.logContextProvider.isStreamLabelEnabled('stream-id-1', 'host')).toBe(false);
    expect(runContextQuery).toHaveBeenCalledTimes(1);
  });

  it('keeps the last enabled label active', () => {
    const runContextQuery = jest.fn();
    render(<LogContextUI provider={ds.logContextProvider} row={buildLogRow()} runContextQuery={runContextQuery} />);

    fireEvent.click(screen.getByText('host="h-1"'));
    fireEvent.click(screen.getByText('app="nginx"'));

    expect(ds.logContextProvider.isStreamLabelEnabled('stream-id-1', 'app')).toBe(true);
    expect(runContextQuery).toHaveBeenCalledTimes(1);
  });

  it('resets toggled labels when the modal closes (component unmounts)', () => {
    const { unmount } = render(
      <LogContextUI provider={ds.logContextProvider} row={buildLogRow()} runContextQuery={jest.fn()} />
    );

    fireEvent.click(screen.getByText('host="h-1"'));
    expect(ds.logContextProvider.isStreamLabelEnabled('stream-id-1', 'host')).toBe(false);

    unmount();

    expect(ds.logContextProvider.isStreamLabelEnabled('stream-id-1', 'host')).toBe(true);
  });

  it('shows the _stream_id and a note when the row has no stream labels', () => {
    render(<LogContextUI provider={ds.logContextProvider} row={buildLogRow([{}])} />);
    expect(screen.getByText('_stream_id="stream-id-1"')).toBeInTheDocument();
    expect(screen.getByText(/Stream labels unavailable/i)).toBeInTheDocument();
  });

  it('shows an explanatory message when both _stream and _stream_id are missing', () => {
    const row = {
      rowIndex: 0,
      dataFrame: {
        refId: 'A',
        fields: [
          { name: 'streams', values: [null] },
          { name: 'streamId', values: [''] },
        ],
        length: 1,
      },
      labels: {},
      timeEpochMs: 1700000000000,
    } as unknown as LogRowModel;

    render(<LogContextUI provider={ds.logContextProvider} row={row} />);
    expect(screen.getByText(/Cannot show stream context/i)).toBeInTheDocument();
  });

  it('does not allow toggling off the only stream label', () => {
    const runContextQuery = jest.fn();
    render(
      <LogContextUI provider={ds.logContextProvider} row={buildLogRow([{ app: 'nginx' }])} runContextQuery={runContextQuery} />
    );

    fireEvent.click(screen.getByText('app="nginx"'));

    expect(ds.logContextProvider.isStreamLabelEnabled('stream-id-1', 'app')).toBe(true);
    expect(runContextQuery).not.toHaveBeenCalled();
  });
});
