import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { of } from 'rxjs';

import { dateTime, LoadingState, PanelData, TimeRange, toDataFrame } from '@grafana/data';
import { type PanelRendererProps } from '@grafana/runtime';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { FieldValueVolume } from '../queries/useVolumeQueries';

import { FieldValuesBreakdown } from './FieldValuesBreakdown';

const mockPanelRendererCalls: PanelRendererProps[] = [];

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelRenderer: (props: PanelRendererProps) => {
    mockPanelRendererCalls.push(props);
    return <div data-testid='panel' />;
  },
}));

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

// managed IntersectionObserver: callbacks are collected so intersection can be triggered manually
const intersectionCallbacks: IntersectionObserverCallback[] = [];

beforeAll(() => {
  global.IntersectionObserver = class {
    constructor(cb: IntersectionObserverCallback) {
      intersectionCallbacks.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;

  // jsdom has no ResizeObserver — stub it for useElementWidth
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  // jsdom always measures 0 — report a non-zero width so useElementWidth mounts the panels
  Element.prototype.getBoundingClientRect = jest.fn(
    () => ({ width: 300, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  );
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

beforeEach(() => {
  mockPanelRendererCalls.length = 0;
  intersectionCallbacks.length = 0;
});

const range: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

const frame = toDataFrame({
  fields: [
    { name: 'Time', values: [1] },
    { name: 'Value', values: [10], labels: { level: 'error' } },
  ],
});

const makeVolumeData = (): PanelData => ({
  series: [frame],
  state: LoadingState.Done,
  timeRange: range,
});

const top: FieldValueVolume[] = [
  { value: 'error', total: 30, volumeData: makeVolumeData() },
  { value: 'info', total: 3, volumeData: makeVolumeData() },
];

const query: Query = { refId: 'A', expr: '*' };

const logsFrame = toDataFrame({ fields: [{ name: 'Line', values: ['a log line'] }] });

const makeDatasource = () =>
  ({
    // a non-empty logs sample by default — an empty one now renders the "No data" placeholder
    // instead of the logs PanelRenderer (see BreakdownRow), which several tests below assert on
    query: jest.fn().mockReturnValue(of({ data: [logsFrame] })),
    getActiveLevelRules: jest.fn().mockReturnValue([]),
    logLevelRules: [],
  }) as unknown as VictoriaLogsDatasource;

/** Marks every collected IntersectionObserver as intersecting, as if the row scrolled into view */
const intersectAllRows = () =>
  act(() => {
    intersectionCallbacks.forEach((cb) => cb([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
  });

describe('FieldValuesBreakdown', () => {
  it('renders a row per value with include/exclude actions and totals', async () => {
    const onFilterClick = jest.fn();
    render(
      <FieldValuesBreakdown
        field='level'
        top={top}
        totalValues={2}
        loading={false}
        range={range}
        datasource={makeDatasource()}
        query={query}
        onFilterClick={onFilterClick}
      />
    );
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('(30 hits)')).toBeInTheDocument();
    expect(screen.getByText('(3 hits)')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Filter for level=error'));
    expect(onFilterClick).toHaveBeenCalledWith('error', '=');

    await userEvent.click(screen.getByLabelText('Filter out level=info'));
    expect(onFilterClick).toHaveBeenCalledWith('info', '!=');
  });

  it('renders the volume chart and defers the logs query until the row is visible', async () => {
    const datasource = makeDatasource();
    render(
      <FieldValuesBreakdown
        field='level'
        top={top}
        totalValues={2}
        loading={false}
        range={range}
        datasource={datasource}
        query={query}
        onFilterClick={jest.fn()}
      />
    );

    const errorVolumePanel = mockPanelRendererCalls.find(
      (props) => props.pluginId === 'timeseries' && props.title === 'error'
    );
    expect(errorVolumePanel).toBeDefined();
    // the logs sample is lazy — it must not fire before the row has been observed as visible
    expect(datasource.query).not.toHaveBeenCalled();
    expect(mockPanelRendererCalls.some((props) => props.pluginId === 'logs')).toBe(false);

    intersectAllRows();

    await waitFor(() => expect(datasource.query).toHaveBeenCalled());
    await waitFor(() => {
      const logsPanel = mockPanelRendererCalls.find((props) => props.pluginId === 'logs');
      expect(logsPanel).toBeDefined();
      expect(logsPanel?.options).toEqual({
        showTime: true,
        enableLogDetails: false,
        dedupStrategy: 'none',
        sortOrder: 'Descending',
        fontSize: 'small',
        wrapLogMessage: false,
      });
    });
  });

  it('shows "(empty)" as the row title for an empty value', () => {
    const emptyValueTop: FieldValueVolume[] = [{ value: '', total: 5, volumeData: makeVolumeData() }];
    render(
      <FieldValuesBreakdown
        field='level'
        top={emptyValueTop}
        totalValues={1}
        loading={false}
        range={range}
        datasource={makeDatasource()}
        query={query}
        onFilterClick={jest.fn()}
      />
    );
    expect(screen.getByText('(empty)')).toBeInTheDocument();
  });

  it('shows the truncation note when values were cut', () => {
    render(
      <FieldValuesBreakdown
        field='level'
        top={top}
        totalValues={34}
        loading={false}
        range={range}
        datasource={makeDatasource()}
        query={query}
        onFilterClick={jest.fn()}
      />
    );
    expect(screen.getByText('Loaded 2 of 34 values')).toBeInTheDocument();
  });

  it('marks the truncation note with a "+" when the server truncated unattributed hits', () => {
    render(
      <FieldValuesBreakdown
        field='level'
        top={top}
        totalValues={34}
        loading={false}
        range={range}
        datasource={makeDatasource()}
        query={query}
        onFilterClick={jest.fn()}
        serverTruncated
      />
    );
    expect(screen.getByText('Loaded 2 of 34+ values')).toBeInTheDocument();
  });

  it('shows the truncation note when server-truncated even if every value fit within the top list', () => {
    render(
      <FieldValuesBreakdown
        field='level'
        top={top}
        totalValues={top.length}
        loading={false}
        range={range}
        datasource={makeDatasource()}
        query={query}
        onFilterClick={jest.fn()}
        serverTruncated
      />
    );
    expect(screen.getByText(`Loaded ${top.length} of ${top.length}+ values`)).toBeInTheDocument();
  });

  it('keeps rendering the rows (instead of the placeholder) while loading if previous values are still present', () => {
    render(
      <FieldValuesBreakdown
        field='level'
        top={top}
        totalValues={2}
        loading
        range={range}
        datasource={makeDatasource()}
        query={query}
        onFilterClick={jest.fn()}
      />
    );
    // a context-only refetch (range/filters changed, same field) keeps `top` populated —
    // the rows must stay mounted (dimmed) rather than being replaced by the placeholder
    expect(screen.queryByText(/Loading level values/)).not.toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('shows an empty state when there are no values', () => {
    render(
      <FieldValuesBreakdown
        field='level'
        top={[]}
        totalValues={0}
        loading={false}
        range={range}
        datasource={makeDatasource()}
        query={query}
        onFilterClick={jest.fn()}
      />
    );
    expect(screen.getByText(/No data for the selected time range/)).toBeInTheDocument();
  });

  it('forwards zoom to the row volume chart', () => {
    const onChangeTimeRange = jest.fn();
    render(
      <FieldValuesBreakdown
        field='level'
        top={top}
        totalValues={2}
        loading={false}
        range={range}
        datasource={makeDatasource()}
        query={query}
        onFilterClick={jest.fn()}
        onChangeTimeRange={onChangeTimeRange}
      />
    );

    const errorVolumePanel = mockPanelRendererCalls.find(
      (props) => props.pluginId === 'timeseries' && props.title === 'error'
    );
    expect(errorVolumePanel?.onChangeTimeRange).toBe(onChangeTimeRange);
  });
});
