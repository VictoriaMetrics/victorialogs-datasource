import { act, renderHook } from '@testing-library/react';

import { FieldConfigSource, LoadingState, PanelData, dateTime, toDataFrame } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';

import { getSeriesLabels, useLegendSeriesToggle } from './useLegendSeriesToggle';

const BASE_CONFIG: FieldConfigSource = { defaults: { unit: 'short' }, overrides: [] };

const hiddenLabels = (fieldConfig: FieldConfigSource): string[] =>
  fieldConfig.overrides.map((o) => o.matcher.options as string);

describe('useLegendSeriesToggle', () => {
  it('returns the base field config untouched while nothing is selected', () => {
    const { result } = renderHook(() => useLegendSeriesToggle(['error', 'info'], BASE_CONFIG));

    expect(result.current.selected.size).toBe(0);
    expect(result.current.fieldConfig).toBe(BASE_CONFIG);
  });

  it('isolates a series on plain click: every other series gets a hideFrom override', () => {
    const { result } = renderHook(() => useLegendSeriesToggle(['error', 'info', 'warn'], BASE_CONFIG));

    act(() => result.current.panelContext.onToggleSeriesVisibility?.('error', SeriesVisibilityChangeMode.ToggleSelection));

    expect([...result.current.selected]).toEqual(['error']);
    expect(hiddenLabels(result.current.fieldConfig)).toEqual(['info', 'warn']);
    expect(result.current.fieldConfig.overrides[0].properties).toEqual([
      { id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: true } },
    ]);
  });

  it('resets the selection when the only selected series is clicked again', () => {
    const { result } = renderHook(() => useLegendSeriesToggle(['error', 'info'], BASE_CONFIG));

    act(() => result.current.panelContext.onToggleSeriesVisibility?.('error', SeriesVisibilityChangeMode.ToggleSelection));
    act(() => result.current.panelContext.onToggleSeriesVisibility?.('error', SeriesVisibilityChangeMode.ToggleSelection));

    expect(result.current.selected.size).toBe(0);
    expect(result.current.fieldConfig).toBe(BASE_CONFIG);
  });

  it('appends and removes series with ctrl/cmd+click', () => {
    const { result } = renderHook(() => useLegendSeriesToggle(['error', 'info', 'warn'], BASE_CONFIG));

    act(() => result.current.panelContext.onToggleSeriesVisibility?.('error', SeriesVisibilityChangeMode.AppendToSelection));
    act(() => result.current.panelContext.onToggleSeriesVisibility?.('info', SeriesVisibilityChangeMode.AppendToSelection));
    expect([...result.current.selected].sort()).toEqual(['error', 'info']);
    expect(hiddenLabels(result.current.fieldConfig)).toEqual(['warn']);

    act(() => result.current.panelContext.onToggleSeriesVisibility?.('info', SeriesVisibilityChangeMode.AppendToSelection));
    expect([...result.current.selected]).toEqual(['error']);
  });

  it('keeps overrides of the base config when adding the hideFrom ones', () => {
    const base: FieldConfigSource = {
      defaults: {},
      overrides: [{ matcher: { id: 'byName', options: 'error' }, properties: [{ id: 'color', value: 'red' }] }],
    };
    const { result } = renderHook(() => useLegendSeriesToggle(['error', 'info'], base));

    act(() => result.current.panelContext.onToggleSeriesVisibility?.('error', SeriesVisibilityChangeMode.ToggleSelection));

    expect(hiddenLabels(result.current.fieldConfig)).toEqual(['error', 'info']);
    expect(result.current.fieldConfig.overrides[0].properties[0].id).toBe('color');
  });

  it('prunes selected series that disappear after a refetch', () => {
    const { result, rerender } = renderHook(({ labels }) => useLegendSeriesToggle(labels, BASE_CONFIG), {
      initialProps: { labels: ['error', 'info'] },
    });

    act(() => result.current.panelContext.onToggleSeriesVisibility?.('error', SeriesVisibilityChangeMode.AppendToSelection));
    act(() => result.current.panelContext.onToggleSeriesVisibility?.('info', SeriesVisibilityChangeMode.AppendToSelection));

    rerender({ labels: ['info'] });

    expect([...result.current.selected]).toEqual(['info']);
  });
});

describe('getSeriesLabels', () => {
  it('returns the display labels of the numeric fields, deduplicated', () => {
    const data: PanelData = {
      series: [
        toDataFrame({
          fields: [
            { name: 'Time', values: [1] },
            { name: 'Value', values: [10], config: { displayNameFromDS: 'error' } },
            { name: 'Value', values: [5], config: { displayNameFromDS: 'info' } },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'Time', values: [1] },
            { name: 'Value', values: [3], config: { displayNameFromDS: 'error' } },
          ],
        }),
      ],
      state: LoadingState.Done,
      timeRange: { from: dateTime(0), to: dateTime(1), raw: { from: 'now-1h', to: 'now' } },
    };

    expect(getSeriesLabels(data)).toEqual(['error', 'info']);
  });
});
