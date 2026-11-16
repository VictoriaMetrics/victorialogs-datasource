import { useEffect } from 'react';

import { CoreApp, LogSortOrderChangeEvent, LogsSortOrder } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';

import { storeKeys } from '../../../store/constants';
import { getExplorePaneSortOrder, getExploreSortOrder } from '../../../store/exploreSortOrder';
import store from '../../../store/store';
import { Query } from '../../../types';

export const useLogsSort = (
  app: CoreApp | undefined,
  query: Query,
  onChange: (query: Query) => void,
  onRunQuery: () => void,
  requestId?: string
) => {
  useEffect(() => {
    if (app !== CoreApp.Dashboard && app !== CoreApp.PanelEditor) {
      return;
    }
    const subscription = getAppEvents().subscribe(LogSortOrderChangeEvent, (sortEvent: LogSortOrderChangeEvent) => {
      const direction = sortEvent.payload.order === 'Ascending' ? 'asc' : 'desc';
      if (query.direction !== direction) {
        onChange({ ...query, direction: direction });
        onRunQuery();
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [app, onChange, onRunQuery, query]);

  useEffect(() => {
    if (app !== CoreApp.Explore) {
      return;
    }
    // re-run only when the order of this pane changes, so the other panes of a split view keep their logs
    let sortOrder = getExploreSortOrder(requestId);
    const runOnChange = (nextSortOrder: LogsSortOrder) => {
      if (nextSortOrder !== sortOrder) {
        sortOrder = nextSortOrder;
        onRunQuery();
      }
    };
    // the pane state in the URL carries the order of each pane since Grafana 12.4. Without it a URL
    // change says nothing about the order, so the store is not consulted here
    const unlistenLocation = locationService.getHistory().listen(() => {
      const paneSortOrder = getExplorePaneSortOrder(requestId);
      if (paneSortOrder) {
        runOnChange(paneSortOrder);
      }
    });
    // an older Grafana exposes only the last picked order, in the store; below 12 the store has no subscribe
    const unsubscribeStore =
      'subscribe' in store
        ? store.subscribe(storeKeys.LOGS_SORT_ORDER, () => {
          if (!getExplorePaneSortOrder(requestId)) {
            runOnChange(getExploreSortOrder(requestId));
          }
        })
        : undefined;
    return () => {
      unlistenLocation();
      unsubscribeStore?.();
    };
  }, [app, onRunQuery, requestId]);
};
