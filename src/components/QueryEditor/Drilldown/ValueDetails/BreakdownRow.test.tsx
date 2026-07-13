import { render, screen } from '@testing-library/react';
import React from 'react';

import { dateTime, FieldConfigSource, LoadingState, PanelData, TimeRange, toDataFrame } from '@grafana/data';
import { type PanelRendererProps } from '@grafana/runtime';

import { BreakdownRow } from './BreakdownRow';

const mockPanelRendererCalls: PanelRendererProps[] = [];

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelRenderer: (props: PanelRendererProps) => {
    mockPanelRendererCalls.push(props);
    return <div data-testid='panel' />;
  },
}));

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

beforeAll(() => {
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
});

const range: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

const frame = toDataFrame({
  fields: [
    { name: 'Time', values: [1] },
    { name: 'Value', values: [10] },
  ],
});

const makeData = (state: LoadingState): PanelData => ({ series: [frame], state, timeRange: range });

describe('BreakdownRow', () => {
  it('mounts both panels once the element widths are known', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
      />
    );

    const volumePanel = mockPanelRendererCalls.find((p) => p.pluginId === 'timeseries');
    const logsPanel = mockPanelRendererCalls.find((p) => p.pluginId === 'logs');
    expect(volumePanel).toBeDefined();
    expect(logsPanel).toBeDefined();
    expect(volumePanel?.title).toBe('error');
    expect(logsPanel?.title).toBe('error logs');
    expect(volumePanel?.width).toBe(300);
    expect(logsPanel?.width).toBe(300);
  });

  it('forwards onChangeTimeRange and merges the unit into chartFieldConfig for the volume chart', () => {
    const onChangeTimeRange = jest.fn();
    const chartFieldConfig: FieldConfigSource = {
      defaults: { custom: { drawStyle: 'bars', fillOpacity: 100, lineWidth: 1 } },
      overrides: [],
    };
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
        onChangeTimeRange={onChangeTimeRange}
        chartFieldConfig={chartFieldConfig}
      />
    );

    const volumePanel = mockPanelRendererCalls.find((p) => p.pluginId === 'timeseries');
    expect(volumePanel?.onChangeTimeRange).toBe(onChangeTimeRange);
    // the 'short' unit is merged in on top of the custom bars config, not dropped
    expect(volumePanel?.fieldConfig).toEqual({
      defaults: { custom: { drawStyle: 'bars', fillOpacity: 100, lineWidth: 1 }, unit: 'short' },
      overrides: [],
    });
  });

  it('defaults the volume chart field config to the short unit when no chartFieldConfig is given', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
      />
    );

    const volumePanel = mockPanelRendererCalls.find((p) => p.pluginId === 'timeseries');
    expect(volumePanel?.fieldConfig).toEqual({ defaults: { unit: 'short' }, overrides: [] });
  });

  it('does not pass chartFieldConfig to the logs panel', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
        chartFieldConfig={{ defaults: { custom: { drawStyle: 'bars' } }, overrides: [] }}
      />
    );

    const logsPanel = mockPanelRendererCalls.find((p) => p.pluginId === 'logs');
    expect(logsPanel?.fieldConfig).toBeUndefined();
  });

  it('shows the level legend table on the right when showChartLegend is set', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
        showChartLegend
      />
    );

    const volumePanel = mockPanelRendererCalls.find((p) => p.pluginId === 'timeseries');
    expect(volumePanel?.options).toEqual(
      expect.objectContaining({
        legend: { showLegend: true, displayMode: 'table', placement: 'right', calcs: ['sum'] },
      })
    );
  });

  it('hides the chart legend by default', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
      />
    );

    const volumePanel = mockPanelRendererCalls.find((p) => p.pluginId === 'timeseries');
    expect(volumePanel?.options).toEqual(expect.objectContaining({ legend: { showLegend: false } }));
  });

  it('renders logs options exactly, with loading and error states for the logs panel', () => {
    const { rerender } = render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={{ series: [], state: LoadingState.Loading, timeRange: range }}
        inViewRef={() => {}}
      />
    );
    expect(screen.getByText('Loading logs...')).toBeInTheDocument();

    rerender(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={{ series: [], state: LoadingState.Error, timeRange: range, errors: [{ message: 'boom' }] }}
        inViewRef={() => {}}
      />
    );
    expect(screen.getByText('boom')).toBeInTheDocument();

    rerender(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
      />
    );
    const logsPanel = mockPanelRendererCalls.find((p) => p.pluginId === 'logs');
    expect(logsPanel?.options).toEqual({
      showTime: true,
      wrapLogMessage: false,
      enableLogDetails: false,
      dedupStrategy: 'none',
      sortOrder: 'Descending',
      fontSize: 'small',
    });
  });

  it('keeps rendering the logs panel (dimmed) instead of the placeholder when a refetch is loading but previous logs are still present', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Loading)}
        inViewRef={() => {}}
      />
    );

    // a refetch (same identity) keeps the previous logs series populated while Loading — the
    // panel must stay mounted (dimmed) instead of being replaced by the placeholder
    expect(screen.queryByText('Loading logs...')).not.toBeInTheDocument();
    expect(mockPanelRendererCalls.some((p) => p.pluginId === 'logs')).toBe(true);
  });

  it('shows a "No data" placeholder instead of the chart when volumeData is Done with an empty series', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={{ series: [], state: LoadingState.Done, timeRange: range }}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
      />
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(mockPanelRendererCalls.some((p) => p.pluginId === 'timeseries')).toBe(false);
  });

  it('shows a "No data" placeholder instead of the logs panel when logsData is Done with an empty series', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={{ series: [], state: LoadingState.Done, timeRange: range }}
        inViewRef={() => {}}
      />
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(mockPanelRendererCalls.some((p) => p.pluginId === 'logs')).toBe(false);
  });

  it('does not show the "No data" placeholder for the logs panel once logsData has a series', () => {
    render(
      <BreakdownRow
        title='error'
        panelTitle='error'
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
      />
    );
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
  });

  it('renders the title and actions in the header', () => {
    render(
      <BreakdownRow
        title={<span>Header title</span>}
        panelTitle='error'
        actions={<button>Action</button>}
        volumeData={makeData(LoadingState.Done)}
        logsData={makeData(LoadingState.Done)}
        inViewRef={() => {}}
      />
    );
    expect(screen.getByText('Header title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });
});
