import { LoadingState, PanelData } from '@grafana/data';

import { Query } from '../../../types';

import { getExportBlock, QUERY_ERROR_BLOCK, QUERY_NOT_RUN_BLOCK } from './exportBlock';

const query: Query = { refId: 'A', expr: 'app:nginx' };

const panelDataOf = (targets: Query[], state = LoadingState.Done): PanelData =>
  ({ state, request: { targets } }) as unknown as PanelData;

describe('getExportBlock', () => {
  it('allows the export of the query that the panel shows', () => {
    expect(getExportBlock(query, panelDataOf([{ ...query }]))).toBeUndefined();
  });

  it('blocks the export before the first run', () => {
    expect(getExportBlock(query, undefined)).toBe(QUERY_NOT_RUN_BLOCK);
  });

  it('blocks the export when only a different query ran', () => {
    expect(getExportBlock(query, panelDataOf([{ ...query, refId: 'B' }]))).toBe(QUERY_NOT_RUN_BLOCK);
  });

  it('blocks the export when the expression changed after the run', () => {
    expect(getExportBlock(query, panelDataOf([{ ...query, expr: 'app:apache' }]))).toBe(QUERY_NOT_RUN_BLOCK);
  });

  it('blocks the export when the stream filters changed after the run', () => {
    const edited: Query = { ...query, streamFilters: [{ label: 'app', operator: 'in', values: ['nginx'] }] };

    expect(getExportBlock(edited, panelDataOf([{ ...query, streamFilters: [] }]))).toBe(QUERY_NOT_RUN_BLOCK);
  });

  it('blocks the export when the ad hoc filters changed after the run', () => {
    const edited: Query = { ...query, adHocFilters: [{ key: 'level', operator: '=', value: 'error' }] };

    expect(getExportBlock(edited, panelDataOf([{ ...query, adHocFilters: [] }]))).toBe(QUERY_NOT_RUN_BLOCK);
  });

  it('blocks the export when the query returned an error', () => {
    expect(getExportBlock(query, panelDataOf([{ ...query }], LoadingState.Error))).toBe(QUERY_ERROR_BLOCK);
  });
});
