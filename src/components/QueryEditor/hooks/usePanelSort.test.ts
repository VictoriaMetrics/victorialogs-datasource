import { renderHook } from '@testing-library/react';

import { CoreApp } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { storeKeys } from '../../../store/constants';
import store from '../../../store/store';
import { Query, QueryType } from '../../../types';

import { useLogsSort } from './usePanelSort';

const query = { expr: '*', refId: 'A', queryType: QueryType.Instant } as Query;

const openExplore = (orders: Record<string, string | undefined>) => {
  const panes = Object.fromEntries(
    Object.entries(orders).map(([id, sortOrder]) => [id, { panelsState: sortOrder ? { logs: { sortOrder } } : {} }])
  );
  locationService.push(`/explore?panes=${encodeURIComponent(JSON.stringify(panes))}`);
};

describe('useLogsSort in Explore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    store.set(storeKeys.LOGS_SORT_ORDER, 'Descending');
    locationService.push('/');
  });

  it('re-runs the query of the pane whose sort order changed, and only that one', () => {
    openExplore({ abc: 'Descending', xyz: 'Descending' });
    const runLeft = jest.fn();
    const runRight = jest.fn();
    renderHook(() => useLogsSort(CoreApp.Explore, query, jest.fn(), runLeft, 'explore_abc'));
    renderHook(() => useLogsSort(CoreApp.Explore, query, jest.fn(), runRight, 'explore_xyz'));

    openExplore({ abc: 'Descending', xyz: 'Ascending' });

    expect(runLeft).not.toHaveBeenCalled();
    expect(runRight).toHaveBeenCalledTimes(1);
  });

  it('does not re-run on a URL change that keeps the sort order', () => {
    openExplore({ abc: 'Descending' });
    const onRunQuery = jest.fn();
    renderHook(() => useLogsSort(CoreApp.Explore, query, jest.fn(), onRunQuery, 'explore_abc'));

    locationService.partial({ orgId: 2 });

    expect(onRunQuery).not.toHaveBeenCalled();
  });

  it('ignores the last picked order while the pane carries its own', () => {
    openExplore({ abc: 'Descending' });
    const onRunQuery = jest.fn();
    renderHook(() => useLogsSort(CoreApp.Explore, query, jest.fn(), onRunQuery, 'explore_abc'));

    store.set(storeKeys.LOGS_SORT_ORDER, 'Ascending');

    expect(onRunQuery).not.toHaveBeenCalled();
  });

  it('follows the last picked order when the pane state has none', () => {
    store.set(storeKeys.LOGS_SORT_ORDER, 'Descending');
    openExplore({ abc: undefined });
    const onRunQuery = jest.fn();
    renderHook(() => useLogsSort(CoreApp.Explore, query, jest.fn(), onRunQuery, 'explore_abc'));

    store.set(storeKeys.LOGS_SORT_ORDER, 'Ascending');

    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });

  // Grafana below 12: no pane state in the URL and no store subscription
  it('does not re-run on a URL change when the pane state has no order, whatever the last picked one', () => {
    openExplore({ abc: undefined });
    const onRunQuery = jest.fn();
    renderHook(() => useLogsSort(CoreApp.Explore, query, jest.fn(), onRunQuery, 'explore_abc'));

    jest.spyOn(store, 'get').mockReturnValue('Ascending');
    locationService.partial({ orgId: 2 });

    expect(onRunQuery).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    openExplore({ abc: 'Descending' });
    const onRunQuery = jest.fn();
    const { unmount } = renderHook(() => useLogsSort(CoreApp.Explore, query, jest.fn(), onRunQuery, 'explore_abc'));

    unmount();
    openExplore({ abc: 'Ascending' });

    expect(onRunQuery).not.toHaveBeenCalled();
  });

  it('does not listen outside Explore', () => {
    openExplore({ abc: 'Descending' });
    const onRunQuery = jest.fn();
    renderHook(() => useLogsSort(CoreApp.Unknown, query, jest.fn(), onRunQuery, 'explore_abc'));

    openExplore({ abc: 'Ascending' });

    expect(onRunQuery).not.toHaveBeenCalled();
  });
});
