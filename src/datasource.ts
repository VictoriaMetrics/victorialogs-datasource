import { defaults } from 'lodash';
import { lastValueFrom, merge, Observable } from "rxjs";
import { map } from 'rxjs/operators';

import {
  AdHocVariableFilter,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  LegacyMetricFindQueryOptions,
  LiveChannelScope,
  LoadingState,
  MetricFindValue,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import {
  BackendSrvRequest,
  DataSourceWithBackend,
  FetchResponse,
  getBackendSrv,
  getGrafanaLiveSrv,
  getTemplateSrv,
  TemplateSrv,
} from '@grafana/runtime';

import { transformBackendResult } from "./backendResultTransformer";
import QueryEditor from "./components/QueryEditor/QueryEditor";
import { escapeLabelValueInSelector, isRegexSelector } from "./languageUtils";
import LogsQlLanguageProvider from "./language_provider";
import { addLabelToQuery, queryHasFilter, removeLabelFromQuery } from "./modifyQuery";
import { replaceVariables, returnVariables } from "./parsingUtils";
import { regularEscape } from "./regexUtils";
import {
  FilterActionType,
  FilterFieldType,
  Options,
  Query,
  QueryBuilderLimits,
  QueryFilterOptions,
  QueryType,
  RequestArguments,
  ToggleFilterAction,
  VariableQuery,
} from './types';
import { VariableSupport } from "./variableSupport/VariableSupport";

export class VictoriaLogsDatasource
  extends DataSourceWithBackend<Query, Options> {
  id: number;
  uid: string;
  url: string;
  maxLines: number;
  basicAuth?: string;
  withCredentials?: boolean;
  httpMethod: string;
  customQueryParameters: URLSearchParams;
  languageProvider?: LogsQlLanguageProvider;
  queryBuilderLimits?: QueryBuilderLimits;

  constructor(
    instanceSettings: DataSourceInstanceSettings<Options>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    languageProvider?: LogsQlLanguageProvider,
  ) {
    super(instanceSettings);

    const settingsData = instanceSettings.jsonData || {};
    this.id = instanceSettings.id;
    this.uid = instanceSettings.uid;
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
    this.variables = new VariableSupport(this);
    this.queryBuilderLimits = instanceSettings.jsonData.queryBuilderLimits;
  }

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const queries = request.targets.filter(q => q.expr).map((q) => {
      return {
        ...q,
        queryType: determineQueryType(request.panelPluginId),
        maxLines: q.maxLines ?? this.maxLines,
      }
    });

    const fixedRequest: DataQueryRequest<Query> = {
      ...request,
      targets: queries,
    };

    if (fixedRequest.liveStreaming) {
      return this.runLiveQueryThroughBackend(fixedRequest);
    }

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

  interpolateQueryExpr(value: any, _variable: any) {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      const combinedValues = value.join(' OR ');
      return value.length > 1 ? `(${combinedValues})` : combinedValues;
    }

    return value;
  }

  async metadataRequest({ url, params, options }: RequestArguments) {
    return await lastValueFrom(
      this._request({
        url: `/api/datasources/proxy/${this.id}/${url.replace(/^\//, '')}`,
        params,
        options: { method: 'GET', hideFromInspector: true, ...options },
      })
    )
  }

  _request<T = any>({ url, params = {}, options: overrides }: RequestArguments): Observable<FetchResponse<T>> {
    const queryUrl = url.startsWith(`/api/datasources/proxy/${this.id}`) ? url : `${this.url}/${url}`;

    const options: BackendSrvRequest = defaults(overrides, {
      url: queryUrl,
      method: this.httpMethod,
      headers: {},
      credentials: this.basicAuth || this.withCredentials ? 'include' : 'same-origin',
    });

    for (const [key, value] of this.customQueryParameters) {
      if (params[key] == null) {
        params[key] = value;
      }
    }

    if (options.method === 'GET' && Object.keys(params).length) {
      const searchParams = new URLSearchParams(params);
      const separator = options.url.search(/\?/) >= 0 ? '&' : '?'
      options.url += separator + searchParams.toString()
    }

    if (options.method !== 'GET') {
      options.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
      options.data = params;
    }

    if (this.basicAuth) {
      options.headers!.Authorization = this.basicAuth;
    }

    return getBackendSrv().fetch<T>(options);
  }

  async metricFindQuery(
    query: VariableQuery,
    options?: LegacyMetricFindQueryOptions
  ): Promise<MetricFindValue[]> {
    if (!query) {
      return Promise.resolve([]);
    }

    const interpolatedVariableQuery: VariableQuery = {
      ...query,
      field: this.interpolateString(query.field || '', options?.scopedVars),
      query: this.interpolateString(query.query || '', options?.scopedVars),
    };

    return await this.processMetricFindQuery(interpolatedVariableQuery, options?.range);
  }

  interpolateString(string: string, scopedVars?: ScopedVars) {
    return this.templateSrv.replace(string, scopedVars, this.interpolateQueryExpr);
  }

  private async processMetricFindQuery(query: VariableQuery, timeRange?: TimeRange): Promise<MetricFindValue[]> {
    const list = await this.languageProvider?.getFieldList({
      type: query.type,
      timeRange,
      field: query.field,
      query: query.query,
      limit: query.limit,
    });
    return (list ? list.map(({ value }) => ({ text: value })) : [])
  }

  getQueryBuilderLimits(key: FilterFieldType): number {
    return this.queryBuilderLimits?.[key] || 0;
  }

  private runLiveQueryThroughBackend(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const observables = request.targets.map((query, index) => {
      return getGrafanaLiveSrv().getDataStream({
        addr: {
          scope: LiveChannelScope.DataSource,
          namespace: this.uid,
          path: `vl/${query.refId}`, // this will allow each new query to create a new connection
          data: {
            ...query,
          },
        },
      }).pipe(map((response) => {
        return {
          data: response.data || [],
          key: `victorialogs-datasource-${query.refId}`,
          state: LoadingState.Streaming,
        };
      }));
    });

    return merge(...observables);
  }
}

function determineQueryType(panelPluginId?: string) {
  if (panelPluginId && !['logs', 'table', 'timeseries'].includes(panelPluginId)) {
    return QueryType.Stats;
  }
  if (panelPluginId === 'timeseries') {
    return QueryType.StatsRange;
  }
  return QueryType.Instant;
}
