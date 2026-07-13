import { renderHook, waitFor } from '@testing-library/react';
import { of, Subject, throwError } from 'rxjs';

import { dateTime, LoadingState, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import { FIELD_HITS_LIMIT } from './drilldownQueries';
import { makeDatasource, makeHitsFrame, makeLabeledFrame, query, range } from './hookTestUtils';
import { useFieldValuesHits, useLogsVolume } from './useVolumeQueries';

describe('useLogsVolume', () => {
  it('produces PanelData from the volume query', async () => {
    const datasource = makeDatasource();
    const { result } = renderHook(() => useLogsVolume(datasource, query, range));
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Done));
    expect(result.current.series.length).toBeGreaterThan(0);
    // the volume query is derived through the existing supplementary-query path
    expect(datasource.getSupplementaryQuery).toHaveBeenCalled();
  });

  it('extracts the message from a plain DataQueryError object instead of stringifying it', async () => {
    // queryLogsVolume forwards an in-band error object (not an Error instance) to the
    // observable's error channel — errorMessage must read `.message` off it, not String(e)
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [], error: { message: 'boom' } })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useLogsVolume(datasource, query, range));
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Error));
    expect(result.current.errors?.[0].message).toBe('boom');
  });

  it('re-runs the volume query when adHocFilters change on an otherwise unchanged expr', async () => {
    const datasource = makeDatasource();
    const { rerender } = renderHook(({ q }: { q: Query }) => useLogsVolume(datasource, q, range), {
      initialProps: { q: query },
    });
    await waitFor(() => expect(datasource.getSupplementaryQuery).toHaveBeenCalledTimes(1));

    const withFilter: Query = { ...query, adHocFilters: [{ key: 'level', operator: '=', value: 'error' }] };
    rerender({ q: withFilter });

    await waitFor(() => expect(datasource.getSupplementaryQuery).toHaveBeenCalledTimes(2));
    const lastRawQuery = (datasource.getSupplementaryQuery as jest.Mock).mock.calls.at(-1)![1];
    expect(lastRawQuery.adHocFilters).toEqual(withFilter.adHocFilters);
  });

  it('keeps the previous series (as Loading) during a context-only refetch — e.g. the time range changed', async () => {
    // the second query() call never completes, so the hook is observed mid-refetch
    const pending = new Subject();
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValueOnce(of({ data: [makeHitsFrame('error', [10])] })).mockReturnValue(pending),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(({ r }: { r: TimeRange }) => useLogsVolume(datasource, query, r), {
      initialProps: { r: range },
    });
    await waitFor(() => expect(result.current.state).toBe(LoadingState.Done));
    expect(result.current.series.length).toBeGreaterThan(0);

    const newRange: TimeRange = {
      from: dateTime('2026-07-06T02:00:00Z'),
      to: dateTime('2026-07-06T03:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    };
    rerender({ r: newRange });

    // queryLogsVolume synchronously emits {state: Loading, data: []} on (re)subscribe — the
    // previous series must still be there instead of being wiped to []
    expect(result.current.state).toBe(LoadingState.Loading);
    expect(result.current.series.length).toBeGreaterThan(0);
  });
});

describe('useFieldValuesHits', () => {
  const hitsFrames = [
    makeLabeledFrame({ app: 'web', level: 'error' }, [10, 0]),
    makeLabeledFrame({ app: 'web', level: 'info' }, [1, 1]),
    makeLabeledFrame({ app: 'api', level: 'info' }, [3, 0]),
  ];

  it('returns per-value level-stacked volume data sorted by hits', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: hitsFrames })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useFieldValuesHits(datasource, query, 'app', range));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.top.map((t) => t.value)).toEqual(['web', 'api']);
    expect(result.current.top[0].total).toBe(12);
    expect(result.current.totalValues).toBe(2);
    // level-stacked series come from aggregateRawLogsVolume: one frame per level
    expect(result.current.top[0].volumeData.series.length).toBe(2);
    expect(result.current.top[0].volumeData.state).toBe(LoadingState.Done);
    // row charts use the narrower DRILLDOWN_ROW_BARS grid (50), not the main volume panel's 100
    expect(result.current.top[0].volumeData.series[0].length).toBe(50);
  });

  it('requests hits grouped by the field plus level fields', async () => {
    const datasource = makeDatasource({
      getActiveLevelRules: jest.fn().mockReturnValue([{ field: 'severity', enabled: true }]),
    } as Partial<VictoriaLogsDatasource>);
    renderHook(() => useFieldValuesHits(datasource, query, 'app', range));
    await waitFor(() => expect(datasource.query).toHaveBeenCalled());
    const request = (datasource.query as jest.Mock).mock.calls[0][0];
    expect(request.targets[0].fields).toEqual(['app', 'severity', 'level']);
  });

  it('scales fieldsLimit by the number of grouping fields — fields_limit bounds tuples, not values', async () => {
    const datasource = makeDatasource({
      getActiveLevelRules: jest.fn().mockReturnValue([{ field: 'severity', enabled: true }]),
    } as Partial<VictoriaLogsDatasource>);
    renderHook(() => useFieldValuesHits(datasource, query, 'app', range));
    await waitFor(() => expect(datasource.query).toHaveBeenCalled());
    const request = (datasource.query as jest.Mock).mock.calls[0][0];
    // grouping fields here: app, severity, level — 3 fields
    expect(request.targets[0].fieldsLimit).toBe(FIELD_HITS_LIMIT * 3);
  });

  it('reports serverTruncated when the response includes a labels-less remainder frame', async () => {
    const remainderFrame = makeLabeledFrame({}, [99]);
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [...hitsFrames, remainderFrame] })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useFieldValuesHits(datasource, query, 'app', range));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.serverTruncated).toBe(true);
  });

  it('does nothing until a field is selected', () => {
    const datasource = makeDatasource();
    const { result } = renderHook(() => useFieldValuesHits(datasource, query, undefined, range));
    expect(result.current.loading).toBe(false);
    expect(result.current.top).toEqual([]);
    expect(datasource.query).not.toHaveBeenCalled();
  });

  it('resets loading when the field is cleared while a request is pending', () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(new Subject()),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(({ field }: { field?: string }) => useFieldValuesHits(datasource, query, field, range), {
      initialProps: { field: 'app' as string | undefined },
    });
    expect(result.current.loading).toBe(true);
    rerender({ field: undefined });
    expect(result.current.loading).toBe(false);
    expect(result.current.top).toEqual([]);
  });

  it('reports query errors', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(throwError(() => new Error('query failed'))),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useFieldValuesHits(datasource, query, 'app', range));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('query failed');
  });

  it('reports an in-band error emitted alongside a next value instead of treating it as data', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [], error: { message: 'query failed in-band' } })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useFieldValuesHits(datasource, query, 'app', range));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('query failed in-band');
    expect(result.current.top).toEqual([]);
  });

  it('does not overwrite an in-band error with the partial data delivered alongside it on complete', async () => {
    // the observable can still deliver a data frame on the same next-emission as the error —
    // `complete` must not turn that partial frame into a `top` entry once an error was reported
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [hitsFrames[0]], error: { message: 'boom' } })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useFieldValuesHits(datasource, query, 'app', range));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.top).toEqual([]);
  });

  it('re-runs the hits query when adHocFilters change on an otherwise unchanged expr', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: hitsFrames })),
    } as Partial<VictoriaLogsDatasource>);
    const { rerender } = renderHook(({ q }: { q: Query }) => useFieldValuesHits(datasource, q, 'app', range), {
      initialProps: { q: query },
    });
    await waitFor(() => expect(datasource.query).toHaveBeenCalledTimes(1));

    const withFilter: Query = { ...query, adHocFilters: [{ key: 'level', operator: '=', value: 'error' }] };
    rerender({ q: withFilter });

    await waitFor(() => expect(datasource.query).toHaveBeenCalledTimes(2));
    const lastRequest = (datasource.query as jest.Mock).mock.calls.at(-1)![0];
    expect(lastRequest.targets[0].adHocFilters).toEqual(withFilter.adHocFilters);
  });

  it('keeps the previous top during a context-only refetch — same field, range changed', async () => {
    // the second query() call never completes, so the hook is observed mid-refetch
    const pending = new Subject();
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValueOnce(of({ data: hitsFrames })).mockReturnValue(pending),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(({ r }: { r: TimeRange }) => useFieldValuesHits(datasource, query, 'app', r), {
      initialProps: { r: range },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.top.length).toBeGreaterThan(0);

    const newRange: TimeRange = {
      from: dateTime('2026-07-06T02:00:00Z'),
      to: dateTime('2026-07-06T03:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    };
    rerender({ r: newRange });

    expect(result.current.loading).toBe(true);
    expect(result.current.top.length).toBeGreaterThan(0);
  });

  it('clears top immediately when the field changes to a different field — stale rows must not leak into the new tab', async () => {
    // the second query() call never completes, so the hook is observed mid-fetch for the new field
    const pending = new Subject();
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValueOnce(of({ data: hitsFrames })).mockReturnValue(pending),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(({ field }: { field: string }) => useFieldValuesHits(datasource, query, field, range), {
      initialProps: { field: 'app' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.top.length).toBeGreaterThan(0);

    rerender({ field: 'level' });

    expect(result.current.loading).toBe(true);
    expect(result.current.top).toEqual([]);
  });
});
