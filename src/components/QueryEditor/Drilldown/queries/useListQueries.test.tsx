import { renderHook, waitFor } from '@testing-library/react';
import { of, Subject } from 'rxjs';

import { dateTime, TimeRange, toDataFrame } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import { PATTERNS_LIMIT, PATTERNS_SAMPLE_FACTOR } from './drilldownQueries';
import { makeDatasource, query, range } from './hookTestUtils';
import { usePatternsList } from './useListQueries';

describe('usePatternsList', () => {
  const makePatternsListFrame = (rows: Array<[string, number]>) =>
    toDataFrame({
      fields: [
        { name: 'Time', values: rows.map(() => 0) },
        { name: 'Line', values: rows.map(([pattern]) => pattern) },
        { name: 'labels', values: rows.map(([, hits]) => ({ hits: String(hits) })) },
      ],
    });

  it('stays idle until enabled', () => {
    const datasource = makeDatasource();
    const { result } = renderHook(() => usePatternsList(datasource, query, range, false));
    expect(result.current.loading).toBe(false);
    expect(result.current.patterns).toEqual([]);
    expect(result.current.totalPatterns).toBe(0);
    expect(datasource.query).not.toHaveBeenCalled();
  });

  it('returns patterns with counts scaled back from the sampled query', async () => {
    const listFrame = makePatternsListFrame([
      ['pattern-b', 20],
      ['pattern-a', 5],
      ['pattern-c', 1],
    ]);
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [listFrame] })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => usePatternsList(datasource, query, range, true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.patterns.map((p) => p.pattern)).toEqual(['pattern-b', 'pattern-a', 'pattern-c']);
    expect(result.current.patterns[0].approxTotal).toBe(20 * PATTERNS_SAMPLE_FACTOR);
    expect(result.current.totalPatterns).toBe(3);
    expect(result.current.serverTruncated).toBe(false);
  });

  it('marks serverTruncated and caps the list when the extra detection row comes back', async () => {
    const rows = Array.from({ length: PATTERNS_LIMIT + 1 }, (_, i): [string, number] => [
      `pattern-${i}`,
      PATTERNS_LIMIT + 1 - i,
    ]);
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [makePatternsListFrame(rows)] })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => usePatternsList(datasource, query, range, true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.patterns).toHaveLength(PATTERNS_LIMIT);
    expect(result.current.serverTruncated).toBe(true);
  });

  it('requests the sampled collapse_nums top query', async () => {
    const datasource = makeDatasource();
    renderHook(() => usePatternsList(datasource, query, range, true));
    await waitFor(() => expect(datasource.query).toHaveBeenCalled());
    const request = (datasource.query as jest.Mock).mock.calls[0][0];
    expect(request.targets[0].expr).toContain(
      `| sample ${PATTERNS_SAMPLE_FACTOR} | collapse_nums prettify | top ${PATTERNS_LIMIT + 1} by (_msg)`
    );
  });

  it('reports an in-band error emitted alongside a next value instead of treating it as data', async () => {
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValue(of({ data: [], error: { message: 'patterns failed' } })),
    } as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => usePatternsList(datasource, query, range, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('patterns failed');
    expect(result.current.patterns).toEqual([]);
  });

  it('re-runs the patterns query when adHocFilters change on an otherwise unchanged expr', async () => {
    const datasource = makeDatasource();
    const { rerender } = renderHook(({ q }: { q: Query }) => usePatternsList(datasource, q, range, true), {
      initialProps: { q: query },
    });
    await waitFor(() => expect(datasource.query).toHaveBeenCalledTimes(1));

    const withFilter: Query = { ...query, adHocFilters: [{ key: 'level', operator: '=', value: 'error' }] };
    rerender({ q: withFilter });

    await waitFor(() => expect(datasource.query).toHaveBeenCalledTimes(2));
    const lastRequest = (datasource.query as jest.Mock).mock.calls.at(-1)![0];
    expect(lastRequest.targets[0].adHocFilters).toEqual(withFilter.adHocFilters);
  });

  it('keeps the previous rows during a context-only refetch — range changed, patterns identity is constant', async () => {
    // the second query() call never completes, so the hook is observed mid-refetch
    const pending = new Subject();
    const listFrame = makePatternsListFrame([['pattern-a', 5]]);
    const datasource = makeDatasource({
      query: jest.fn().mockReturnValueOnce(of({ data: [listFrame] })).mockReturnValue(pending),
    } as Partial<VictoriaLogsDatasource>);
    const { result, rerender } = renderHook(({ r }: { r: TimeRange }) => usePatternsList(datasource, query, r, true), {
      initialProps: { r: range },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.patterns.length).toBeGreaterThan(0);

    const newRange: TimeRange = {
      from: dateTime('2026-07-06T02:00:00Z'),
      to: dateTime('2026-07-06T03:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    };
    rerender({ r: newRange });

    expect(result.current.loading).toBe(true);
    expect(result.current.patterns.length).toBeGreaterThan(0);
  });
});
