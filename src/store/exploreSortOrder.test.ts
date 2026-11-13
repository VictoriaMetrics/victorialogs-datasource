import { LogsSortOrder } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { getExplorePaneSortOrder, getExploreSortOrder } from './exploreSortOrder';
import store from './store';

const openExplore = (panes: unknown) => {
  locationService.push(`/explore?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}`);
};

const pane = (sortOrder?: string) => ({ queries: [], panelsState: sortOrder ? { logs: { sortOrder } } : {} });

describe('exploreSortOrder', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    locationService.push('/');
  });

  describe('getExplorePaneSortOrder', () => {
    it('gives each pane of a split view its own order', () => {
      openExplore({ abc: pane('Ascending'), xyz: pane('Descending') });

      expect(getExplorePaneSortOrder('explore_abc')).toBe(LogsSortOrder.Ascending);
      expect(getExplorePaneSortOrder('explore_xyz')).toBe(LogsSortOrder.Descending);
    });

    it('finds the pane of a derived request by the request id prefix', () => {
      openExplore({ abc: pane('Ascending'), xyz: pane('Descending') });

      expect(getExplorePaneSortOrder('explore_abc_logs_volume')).toBe(LogsSortOrder.Ascending);
    });

    it('finds the pane of a request made through the mixed datasource', () => {
      openExplore({ abc: pane('Ascending'), xyz: pane('Descending') });

      expect(getExplorePaneSortOrder('mixed-0-explore_abc')).toBe(LogsSortOrder.Ascending);
      expect(getExplorePaneSortOrder('mixed-1-explore_xyz_logs_volume_0')).toBe(LogsSortOrder.Descending);
    });

    it('finds a pane whose id contains an underscore', () => {
      openExplore({ a_c: pane('Ascending') });

      expect(getExplorePaneSortOrder('explore_a_c')).toBe(LogsSortOrder.Ascending);
    });

    it('gives none when the pane state carries no valid order', () => {
      openExplore({ abc: pane(), xyz: pane('sideways') });

      expect(getExplorePaneSortOrder('explore_abc')).toBeUndefined();
      expect(getExplorePaneSortOrder('explore_xyz')).toBeUndefined();
    });

    it('gives none for an unknown pane, a foreign request id and no request id', () => {
      openExplore({ abc: pane('Ascending') });

      expect(getExplorePaneSortOrder('explore_xyz')).toBeUndefined();
      expect(getExplorePaneSortOrder('log-context-request-A')).toBeUndefined();
      expect(getExplorePaneSortOrder()).toBeUndefined();
    });

    it('gives none when the panes param is missing or broken', () => {
      locationService.push('/explore');
      expect(getExplorePaneSortOrder('explore_abc')).toBeUndefined();

      locationService.push('/explore?panes=%7Bbroken');
      expect(getExplorePaneSortOrder('explore_abc')).toBeUndefined();
    });
  });

  describe('getExploreSortOrder', () => {
    it('prefers the order of the pane over the last picked one', () => {
      jest.spyOn(store, 'get').mockReturnValue('Descending');
      openExplore({ abc: pane('Ascending') });

      expect(getExploreSortOrder('explore_abc')).toBe(LogsSortOrder.Ascending);
    });

    it('falls back to the last picked order when the pane has none', () => {
      jest.spyOn(store, 'get').mockReturnValue('Ascending');
      openExplore({ abc: pane() });

      expect(getExploreSortOrder('explore_abc')).toBe(LogsSortOrder.Ascending);
    });

    it('defaults to descending', () => {
      jest.spyOn(store, 'get').mockReturnValue(null);

      expect(getExploreSortOrder()).toBe(LogsSortOrder.Descending);
    });
  });
});
