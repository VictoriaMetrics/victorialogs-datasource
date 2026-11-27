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
      intervalMs: undefined,
      extraFilters: '{"level":"error"}',
      extraStreamFilters: '{app="nginx"}',
    });
  });

  it('resolves the query when the panel has no request yet', () => {
    const { datasource, applyTemplateVariables } = sourceReturning({ expr: 'error' });

    const exportQuery = resolveExportQuery(datasource, query, undefined);

    expect(applyTemplateVariables).toHaveBeenCalledWith(query, {}, undefined);
    expect(exportQuery).toEqual({ expr: 'error', intervalMs: undefined, extraFilters: undefined, extraStreamFilters: undefined });
  });

  it('keeps the interval and range variables for the backend and sends the interval of the last request', () => {
    const expr = '* | stats by (_time:$__interval) count() | math $__interval_ms | filter _time:$__range';
    const { datasource } = sourceReturning({ expr });

    const exportQuery = resolveExportQuery(datasource, query, panelDataWith({ scopedVars: {}, intervalMs: 30000 }));

    expect(exportQuery.expr).toBe(expr);
    expect(exportQuery.intervalMs).toBe(30000);
  });
});
