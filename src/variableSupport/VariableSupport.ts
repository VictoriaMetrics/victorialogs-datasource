import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, MetricFindValue, ScopedVars, TimeRange } from '@grafana/data';

import { LokiVariableQueryEditor } from '../components/VariableQueryEditor/VariableQueryEditor';
import { VictoriaLogsDatasource } from "../datasource";
import { VariableQuery } from '../types';

export class VariableSupport extends CustomVariableSupport<VictoriaLogsDatasource, VariableQuery> {
  editor = LokiVariableQueryEditor;

  constructor(private datasource: VictoriaLogsDatasource) {
    super();
  }

  async execute(query: VariableQuery, scopedVars: ScopedVars, range: TimeRange) {
    return this.datasource.metricFindQuery(query, { scopedVars, range });
  }

  query(request: DataQueryRequest<VariableQuery>): Observable<{ data: MetricFindValue[] }> {
    const result = this.execute(request.targets[0], request.scopedVars, request.range);

    return from(result).pipe(map((data) => ({ data })));
  }
}
