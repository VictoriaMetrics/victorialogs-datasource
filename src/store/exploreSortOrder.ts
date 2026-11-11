import { LogsSortOrder } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { storeKeys } from './constants';
import store from './store';

const EXPLORE_REQUEST_ID_PREFIX = 'explore_';

type ExplorePanesUrlState = Record<string, { panelsState?: { logs?: { sortOrder?: string } } } | undefined>;

const isLogsSortOrder = (value: unknown): value is LogsSortOrder =>
  value === LogsSortOrder.Ascending || value === LogsSortOrder.Descending;

const getExplorePanesUrlState = (): ExplorePanesUrlState => {
  const { panes } = locationService.getSearchObject();
  if (typeof panes !== 'string') {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(panes);
    return parsed && typeof parsed === 'object' ? (parsed as ExplorePanesUrlState) : {};
  } catch {
    return {};
  }
};

/**
 * The logs sort order of the Explore pane that issued the request, read from the pane state in the URL.
 * Grafana keeps it there since 12.4; none for an older Grafana or a request made outside an Explore pane.
 */
export const getExplorePaneSortOrder = (requestId?: string): LogsSortOrder | undefined => {
  if (!requestId?.startsWith(EXPLORE_REQUEST_ID_PREFIX)) {
    return undefined;
  }
  // a request id is `explore_<paneId>` with an optional suffix of a derived request
  const paneRequestId = requestId.slice(EXPLORE_REQUEST_ID_PREFIX.length);
  const panes = getExplorePanesUrlState();
  const paneId = Object.keys(panes).find((id) => paneRequestId === id || paneRequestId.startsWith(`${id}_`));
  const sortOrder = paneId ? panes[paneId]?.panelsState?.logs?.sortOrder : undefined;
  return isLogsSortOrder(sortOrder) ? sortOrder : undefined;
};

/**
 * The logs sort order for an Explore request: the order of its own pane, so the panes of a split view
 * stay independent. Falls back to the last order picked in any pane, the only one an older Grafana exposes.
 */
export const getExploreSortOrder = (requestId?: string): LogsSortOrder => {
  const paneSortOrder = getExplorePaneSortOrder(requestId);
  if (paneSortOrder) {
    return paneSortOrder;
  }
  return store.get(storeKeys.LOGS_SORT_ORDER) === LogsSortOrder.Ascending
    ? LogsSortOrder.Ascending
    : LogsSortOrder.Descending;
};
