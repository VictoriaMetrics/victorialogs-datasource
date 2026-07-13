import { render, screen } from '@testing-library/react';
import React from 'react';

import { dateTime, LoadingState, PanelData, TimeRange, toDataFrame } from '@grafana/data';
import { type PanelRendererProps } from '@grafana/runtime';

import { VolumePanel } from './VolumePanel';

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

  // jsdom always measures 0 — report a non-zero width so useElementWidth mounts the panel
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

describe('VolumePanel', () => {
  it('renders the timeseries panel forced to the short unit once done', () => {
    const onChangeTimeRange = jest.fn();
    render(<VolumePanel data={makeData(LoadingState.Done)} onChangeTimeRange={onChangeTimeRange} />);

    const volumePanel = mockPanelRendererCalls.find((p) => p.pluginId === 'timeseries');
    expect(volumePanel).toBeDefined();
    expect(volumePanel?.title).toBe('Log volume');
    expect(volumePanel?.width).toBe(300);
    expect(volumePanel?.onChangeTimeRange).toBe(onChangeTimeRange);
    expect(volumePanel?.fieldConfig).toEqual({ defaults: { unit: 'short' }, overrides: [] });
  });

  it('shows a loading placeholder instead of the panel while loading with no previous series', () => {
    render(<VolumePanel data={{ series: [], state: LoadingState.Loading, timeRange: range }} />);

    expect(screen.getByText('Loading log volume...')).toBeInTheDocument();
    expect(mockPanelRendererCalls).toHaveLength(0);
  });

  it('keeps rendering the panel (instead of the placeholder) while loading if a previous series is still present', () => {
    render(<VolumePanel data={makeData(LoadingState.Loading)} />);

    // a context-only refetch (range/filters changed) keeps the previous series in `data` — the
    // panel must stay mounted and dimmed rather than being replaced by the placeholder
    expect(screen.queryByText('Loading log volume...')).not.toBeInTheDocument();
    expect(mockPanelRendererCalls.some((p) => p.pluginId === 'timeseries')).toBe(true);
  });

  it('shows a fixed-height "No data" placeholder instead of collapsing when a completed refetch returns no series', () => {
    render(<VolumePanel data={{ series: [], state: LoadingState.Done, timeRange: range }} />);

    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(mockPanelRendererCalls).toHaveLength(0);
  });

  it('does not show the "No data" placeholder once a series is present', () => {
    render(<VolumePanel data={makeData(LoadingState.Done)} />);
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
  });

  it('shows an error alert instead of the panel on failure', () => {
    render(
      <VolumePanel
        data={{ series: [], state: LoadingState.Error, timeRange: range, errors: [{ message: 'boom' }] }}
      />
    );

    expect(screen.getByText('Failed to load log volume')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(mockPanelRendererCalls).toHaveLength(0);
  });
});
