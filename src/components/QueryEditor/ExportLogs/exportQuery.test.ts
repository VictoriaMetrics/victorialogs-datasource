import { DataQueryRequest, PanelData } from '@grafana/data';

import { Query } from '../../../types';

import { ExportQuerySource, resolveExportQuery } from './exportQuery';

const query: Query = { refId: 'A', expr: 'app:$app' };

const panelDataWith = (request: Partial<DataQueryRequest<Query>>) => ({ request }) as unknown as PanelData;

const sourceReturning = (applied: Partial<Query>) => {
  const applyTemplateVariables = jest.fn().mockReturnValue({ ...query, ...applied });
  const datasource: ExportQuerySource = { applyTemplateVariables };
  return { datasource, applyTemplateVariables };
};

describe('resolveExportQuery', () => {
  it('resolves the query with the scoped variables and the ad hoc filters of the last request', () => {
    const { datasource, applyTemplateVariables } = sourceReturning({
      expr: 'app:nginx',
      extraFilters: '{"level":"error"}',
      extraStreamFilters: '{app="nginx"}',
    });
    const scopedVars = { app: { value: 'nginx', text: 'nginx' } };
    const filters = [{ key: 'level', operator: '=', value: 'error' }];

    const exportQuery = resolveExportQuery(datasource, query, panelDataWith({ scopedVars, filters }));

    expect(applyTemplateVariables).toHaveBeenCalledWith(query, scopedVars, filters);
    expect(exportQuery).toEqual({
      expr: 'app:nginx',
      extraFilters: '{"level":"error"}',
      extraStreamFilters: '{app="nginx"}',
    });
  });

  it('resolves the query when the panel has no request yet', () => {
    const { datasource, applyTemplateVariables } = sourceReturning({ expr: 'error' });

    const exportQuery = resolveExportQuery(datasource, query, undefined);

    expect(applyTemplateVariables).toHaveBeenCalledWith(query, {}, undefined);
    expect(exportQuery).toEqual({ expr: 'error', extraFilters: undefined, extraStreamFilters: undefined });
  });

  it('replaces the interval variables that applyTemplateVariables keeps for the backend', () => {
    const { datasource } = sourceReturning({ expr: '* | stats by (_time:$__interval) count() | math $__interval_ms' });
    const scopedVars = {
      __interval: { value: '30s', text: '30s' },
      __interval_ms: { value: 30000, text: '30000' },
    };

    const exportQuery = resolveExportQuery(datasource, query, panelDataWith({ scopedVars }));

    expect(exportQuery.expr).toBe('* | stats by (_time:30s) count() | math 30000');
  });

  it('keeps the interval variables when the last request has no interval', () => {
    const { datasource } = sourceReturning({ expr: '* | stats by (_time:$__interval) count()' });

    const exportQuery = resolveExportQuery(datasource, query, panelDataWith({ scopedVars: {} }));

    expect(exportQuery.expr).toBe('* | stats by (_time:$__interval) count()');
  });
});
