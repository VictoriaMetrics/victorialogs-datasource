import { Observable } from "rxjs";
import { map } from 'rxjs/operators';

import { DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { transformBackendResult } from "./backendResultTransformer";
import QueryEditor from "./components/QueryEditor/QueryEditor";
import { escapeLabelValueInSelector } from "./languageUtils";
import { addLabelToQuery, queryHasFilter, removeLabelFromQuery } from "./modifyQuery";
import { Query, Options, ToggleFilterAction, QueryFilterOptions, FilterActionType } from './types';

export class VictoriaLogsDatasource
  extends DataSourceWithBackend<Query, Options> {
  maxLines: number;

  constructor(
    instanceSettings: DataSourceInstanceSettings<Options>,
  ) {
    super(instanceSettings);

    const settingsData = instanceSettings.jsonData || {};
    this.maxLines = parseInt(settingsData.maxLines ?? '0', 10) || 10;
    this.annotations = {
      QueryEditor: QueryEditor,
    };
  }

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const queries = request.targets.filter(q => q.expr).map((q) => {
      // include time range in query if not already present
      if (!/_time/.test(q.expr)) {
        const timerange = `_time:[${request.range.from.toISOString()}, ${request.range.to.toISOString()}]`
        q.expr = `${timerange} AND ${q.expr}`;
      }
      return { ...q, maxLines: q.maxLines ?? this.maxLines }
    });

    const fixedRequest: DataQueryRequest<Query> = {
      ...request,
      targets: queries,
    };

    return this.runQuery(fixedRequest);
  }

  runQuery(fixedRequest: DataQueryRequest<Query>) {
    return super
      .query(fixedRequest)
      .pipe(
        map((response) =>
          transformBackendResult(response, fixedRequest.targets, [])
        )
      );
  }

  toggleQueryFilter(query: Query, filter: ToggleFilterAction): Query {
    let expression = query.expr ?? '';

    if (!filter.options?.key || !filter.options?.value) {
      return { ...query, expr: expression };
    }

    const isFilterFor = filter.type === FilterActionType.FILTER_FOR;
    const isFilterOut = filter.type === FilterActionType.FILTER_OUT;
    const value = escapeLabelValueInSelector(filter.options.value);
    const hasFilter = queryHasFilter(expression, filter.options.key, value)
    const operator = filter.type === FilterActionType.FILTER_FOR ? 'AND' : 'NOT';

    if (hasFilter) {
      expression = removeLabelFromQuery(expression, filter.options.key, value);
    }

    if ((isFilterFor && !hasFilter) || isFilterOut) {
      expression = addLabelToQuery(expression, filter.options.key, value, operator);
    }

    return { ...query, expr: expression };
  }

  queryHasFilter(query: Query, filter: QueryFilterOptions): boolean {
    let expression = query.expr ?? '';
    return queryHasFilter(expression, filter.key, filter.value);
  }
}
