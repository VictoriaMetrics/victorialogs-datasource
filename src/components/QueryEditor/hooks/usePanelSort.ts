import { useEffect } from 'react';

import { CoreApp, LogSortOrderChangeEvent } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { storeKeys } from '../../../store/constants';
import store from '../../../store/store';
import { Query } from '../../../types';

export const useLogsSort = (
  app: CoreApp | undefined,
  query: Query,
  onChange: (query: Query) => void,
  onRunQuery: () => void
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
    // grafana with a version below 12 doesn't support subscribe function on store
    if ('subscribe' in store) {
      store.subscribe(storeKeys.LOGS_SORT_ORDER, () => {
        onRunQuery();
      });
    }
  }, [onRunQuery]);
};
