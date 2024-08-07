import { map as lodashMap } from 'lodash';
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';

import {
  AdHocVariableFilter,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  ScopedVars
} from '@grafana/data';
import {
  BackendSrvRequest,
  DataSourceWithBackend,
  getTemplateSrv,
  TemplateSrv
} from '@grafana/runtime';

import { transformBackendResult } from "./backendResultTransformer";
import QueryEditor from "./components/QueryEditor/QueryEditor";
import { escapeLabelValueInSelector, isRegexSelector } from "./languageUtils";
import LogsQlLanguageProvider from "./language_provider";
import { addLabelToQuery, queryHasFilter, removeLabelFromQuery } from "./modifyQuery";
import { replaceVariables, returnVariables } from "./parsingUtils";
import { regularEscape, specialRegexEscape } from "./regexUtils";
import { Query, Options, ToggleFilterAction, QueryFilterOptions, FilterActionType } from './types';

export class VictoriaLogsDatasource
  extends DataSourceWithBackend<Query, Options> {
  id: number;
  url: string;
  maxLines: number;
  basicAuth?: string;
  withCredentials?: boolean;
  httpMethod: string;
  customQueryParameters: URLSearchParams;
  languageProvider?: LogsQlLanguageProvider;

  constructor(
    instanceSettings: DataSourceInstanceSettings<Options>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    languageProvider?: LogsQlLanguageProvider,
  ) {
    super(instanceSettings);

    const settingsData = instanceSettings.jsonData || {};
    this.id = instanceSettings.id;
    this.url = instanceSettings.url!;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.httpMethod = instanceSettings.jsonData.httpMethod || 'POST';
    this.maxLines = parseInt(settingsData.maxLines ?? '0', 10) || 1000;
    this.customQueryParameters = new URLSearchParams(instanceSettings.jsonData.customQueryParameters);
    this.languageProvider = languageProvider ?? new LogsQlLanguageProvider(this);
    this.annotations = {
      QueryEditor: QueryEditor,
    };
  }

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const queries = request.targets.filter(q => q.expr).map((q) => {
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
          transformBackendResult(response, fixedRequest.targets, [], this.maxLines)
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

  applyTemplateVariables(target: Query, scopedVars: ScopedVars, adhocFilters?: AdHocVariableFilter[]): Query {
    const { __auto, __interval, __interval_ms, __range, __range_s, __range_ms, ...rest } = scopedVars || {};
    const exprWithAdHoc = this.addAdHocFilters(target.expr, adhocFilters);

    const variables = {
      ...rest,
      __interval: {
        value: '$__interval',
      },
      __interval_ms: {
        value: '$__interval_ms',
      },
    };
    return {
      ...target,
      legendFormat: this.templateSrv.replace(target.legendFormat, rest),
      expr: this.templateSrv.replace(exprWithAdHoc, variables, this.interpolateQueryExpr),
    };
  }

  addAdHocFilters(queryExpr: string, adhocFilters?: AdHocVariableFilter[]) {
    if (!adhocFilters) {
      return queryExpr;
    }

    let expr = replaceVariables(queryExpr);

    expr = adhocFilters.reduce((acc: string, filter: { key: string; operator: string; value: string }) => {
      const { key, operator } = filter;
      let { value } = filter;
      if (isRegexSelector(operator)) {
        value = regularEscape(value);
      } else {
        value = escapeLabelValueInSelector(value, operator);
      }
      return addLabelToQuery(acc, key, operator, value);
    }, expr);

    return returnVariables(expr);
  }

  interpolateQueryExpr(value: any, variable: any) {
    if (!variable.multi && !variable.includeAll) {
      return regularEscape(value);
    }

    if (typeof value === 'string') {
      return specialRegexEscape(value);
    }

    return lodashMap(value, specialRegexEscape).join('|');
  }

  async metadataRequest(url: string, params?: Record<string, string | number>, options?: Partial<BackendSrvRequest>) {
    if (url.startsWith('/')) {
      throw new Error(`invalid metadata request url: ${url}`);
    }

    console.log('metadataRequest', { url, params, options })
    const res = await this.getResource(url, params, options);
    return res.data || [];
  }
}
