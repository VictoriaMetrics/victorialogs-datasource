import { renderHook, waitFor } from '@testing-library/react';
import { of, Subject } from 'rxjs';

import { dateTime, LoadingState, TimeRange, toDataFrame } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';

import { makeDatasource, query, range } from './hookTestUtils';
import { usePatternLogsSample, useValueLogsSample } from './useLogsSampleQueries';

describe('useValueLogsSample', () => {
  const logsFrame = toDataFrame({ fields: [{ name: 'Line', values: ['a', 'b'] }] });

  it('stays idle until enabled', () => {
    const datasource = makeDatasource();
    const { result } = renderHook(() => useValueLogsSample(datasource, query, 'app', 'web', range, false, 0));
    expect(result.current.state).toBe(LoadingState.NotStarted);
    expect(datasource.query).not.toHaveBeenCalled();
  });

  it('runs the narrowed logs query once enabled', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [logsFrame] })),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(
      ({ enabled }) => useValueLogsSample(datasource, query, 'app', 'web', range, enabled, 0),
      { initialProps: { enabled: false } }
    );
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Done));
    expect(result.current.series).toHaveLength(1);
    const request = (datasource.query as jest.Mock).mock.calls[0][0];
    expect(request.targets[0].maxLines).toBe(50);
    expect(request.targets[0].expr).toContain('app:=');
    // the backend applies `limit` without ordering — the sample must request the latest logs explicitly
    expect(request.targets[0].expr).toMatch(/\| sort by \(_time\) desc$/);
  });

  it('reports in-band response errors', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [], error: { message: 'sample failed' } })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useValueLogsSample(datasource, query, 'app', 'web', range, true, 0));
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Error));
    expect(result.current.errors?.[0]?.message).toBe('sample failed');
  });

  it('keeps the previous series (as Loading) during a context-only refetch — same value, range changed', async () => {
    // the second query() call never completes, so the hook is observed mid-refetch
    const pending = new Subject();
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValueOnce(of({ data: [logsFrame] })).mockReturnValue(pending),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(
      ({ r }: { r: TimeRange }) => useValueLogsSample(datasource, query, 'app', 'web', r, true, 0),
      { initialProps: { r: range } }
    );
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Done));
    expect(result.current.series.length).toBeGreaterThan(0);

    const newRange: TimeRange = {
      from: dateTime('2026-07-06T02:00:00Z'),
      to: dateTime('2026-07-06T03:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    };
    rerender({ r: newRange });

    expect(result.current.state).toBe(LoadingState.Loading);
    expect(result.current.series.length).toBeGreaterThan(0);
  });

  it('resets to empty immediately when the value changes — stale rows must not leak into the new sample', async () => {
    const pending = new Subject();
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValueOnce(of({ data: [logsFrame] })).mockReturnValue(pending),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useValueLogsSample(datasource, query, 'app', value, range, true, 0),
      { initialProps: { value: 'web' } }
    );
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Done));
    expect(result.current.series.length).toBeGreaterThan(0);

    rerender({ value: 'api' });

    expect(result.current.state).toBe(LoadingState.Loading);
    expect(result.current.series).toEqual([]);
  });
});

describe('usePatternLogsSample', () => {
  const logsFrame = toDataFrame({ fields: [{ name: 'Line', values: ['a', 'b'] }] });

  it('stays idle until enabled', () => {
    const datasource = makeDatasource();
    const { result } = renderHook(() => usePatternLogsSample(datasource, query, 'GET /api', range, false, 0));
    expect(result.current.state).toBe(LoadingState.NotStarted);
    expect(datasource.query).not.toHaveBeenCalled();
  });

  it('runs the pattern-filtered logs query once enabled', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [logsFrame] })),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(
      ({ enabled }) => usePatternLogsSample(datasource, query, 'GET /api', range, enabled, 0),
      { initialProps: { enabled: false } }
    );
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Done));
    expect(result.current.series).toHaveLength(1);
    const request = (datasource.query as jest.Mock).mock.calls[0][0];
    // the pattern sample matches the collapsed shape in place — no _msg round trip needed
    expect(request.targets[0].expr).toContain('| filter pattern_match_full("GET /api")');
  });

  it('reports in-band response errors', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [], error: { message: 'pattern sample failed' } })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => usePatternLogsSample(datasource, query, 'GET /api', range, true, 0));
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Error));
    expect(result.current.errors?.[0]?.message).toBe('pattern sample failed');
  });

  it('keeps the previous series (as Loading) during a context-only refetch — same pattern, range changed', async () => {
    // the second query() call never completes, so the hook is observed mid-refetch
    const pending = new Subject();
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValueOnce(of({ data: [logsFrame] })).mockReturnValue(pending),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(
      ({ r }: { r: TimeRange }) => usePatternLogsSample(datasource, query, 'GET /api', r, true, 0),
      { initialProps: { r: range } }
    );
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Done));
    expect(result.current.series.length).toBeGreaterThan(0);

    const newRange: TimeRange = {
      from: dateTime('2026-07-06T02:00:00Z'),
      to: dateTime('2026-07-06T03:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    };
    rerender({ r: newRange });

    expect(result.current.state).toBe(LoadingState.Loading);
    expect(result.current.series.length).toBeGreaterThan(0);
  });

  it('resets to empty immediately when the pattern changes — stale rows must not leak into the new sample', async () => {
    const pending = new Subject();
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValueOnce(of({ data: [logsFrame] })).mockReturnValue(pending),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(
      ({ pattern }: { pattern: string }) => usePatternLogsSample(datasource, query, pattern, range, true, 0),
      { initialProps: { pattern: 'GET /api' } }
    );
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Done));
    expect(result.current.series.length).toBeGreaterThan(0);

    rerender({ pattern: 'POST /api' });

    expect(result.current.state).toBe(LoadingState.Loading);
    expect(result.current.series).toEqual([]);
  });
});
