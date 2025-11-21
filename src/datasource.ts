import { cloneDeep } from 'lodash';
import { lastValueFrom, map, merge, Observable } from "rxjs";

import {
  AdHocVariableFilter,
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  DataSourceInstanceSettings,
  DataSourceWithLogsContextSupport,
  DEFAULT_FIELD_DISPLAY_VALUES_LIMIT,
  Labels,
  LegacyMetricFindQueryOptions,
  LiveChannelScope,
  LoadingState,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
  MetricFindValue,
  QueryVariableModel,
  rangeUtil,
  ScopedVars,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
  TimeRange,
  toUtc,
  TypedVariableModel,
} from '@grafana/data';
import { config, DataSourceWithBackend, getGrafanaLiveSrv, getTemplateSrv, TemplateSrv, } from '@grafana/runtime';
import { DataQuery } from "@grafana/schema";

import { isRegExpOperatorInLastFilter } from "./LogsQL/regExpOperator";
import { transformBackendResult } from "./backendResultTransformer";
import QueryEditor from "./components/QueryEditor/QueryEditor";
import { LogLevelRule } from "./configuration/LogLevelRules/types";
import { TEXT_FILTER_ALL_VALUE, VARIABLE_ALL_VALUE } from "./constants";
import { escapeLabelValueInSelector } from "./languageUtils";
import LogsQlLanguageProvider from "./language_provider";
import { LOGS_VOLUME_BARS, queryLogsVolume } from "./logsVolumeLegacy";
import { addLabelToQuery, addSortPipeToQuery, queryHasFilter, removeLabelFromQuery } from "./modifyQuery";
import { removeDoubleQuotesAroundVar } from "./parsing";
import { replaceOperatorWithIn, returnVariables } from "./parsingUtils";
import { storeKeys } from "./store/constants";
import store from "./store/store";
import {
  DerivedFieldConfig,
  FilterActionType,
  FilterFieldType,
  MultitenancyHeaders,
  Options,
  Query,
  QueryBuilderLimits,
  QueryFilterOptions,
  QueryType,
  SupportingQueryType,
  ToggleFilterAction,
  VariableQuery,
} from './types';
import { getMillisecondsFromDuration } from "./utils/timeUtils";
import { VariableSupport } from "./variableSupport/VariableSupport";

export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
export const REF_ID_STARTER_LOG_SAMPLE = 'log-sample-';
export const REF_ID_STARTER_LOG_CONTEXT_REQUEST = 'log-context-request-';
export const REF_ID_STARTER_LOG_CONTEXT_QUERY = 'log-context-query-';
export const LABEL_STREAM_ID = '_stream_id';

export class VictoriaLogsDatasource
  extends DataSourceWithBackend<Query, Options>
  implements DataSourceWithLogsContextSupport {
  id: number;
  uid: string;
  url: string;
  maxLines: number;
  derivedFields: DerivedFieldConfig[];
  basicAuth?: string;
  withCredentials?: boolean;
  httpMethod: string;
  customQueryParameters: URLSearchParams;
  languageProvider?: LogsQlLanguageProvider;
  queryBuilderLimits?: QueryBuilderLimits;
  logLevelRules: LogLevelRule[];
  multitenancyHeaders?: MultitenancyHeaders;

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
    this.httpMethod = settingsData.httpMethod || 'POST';
    this.maxLines = parseInt(settingsData.maxLines ?? '0', 10) || 1000;
    this.derivedFields = settingsData.derivedFields || [];
    this.customQueryParameters = new URLSearchParams(settingsData.customQueryParameters);
    this.languageProvider = languageProvider ?? new LogsQlLanguageProvider(this);
    this.annotations = {
      QueryEditor: QueryEditor,
    };
    this.variables = new VariableSupport(this);
    this.queryBuilderLimits = settingsData.queryBuilderLimits;
    this.logLevelRules = settingsData.logLevelRules || [];
    this.multitenancyHeaders = settingsData.multitenancyHeaders;
  }

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const sortOrder = store.get(storeKeys.LOGS_SORT_ORDER);
    const queries = request.targets.filter(q => q.expr || config.publicDashboardAccessToken !== '').map((q) => {
      return {
        ...q,
        // to backend sort for limited data to show first logs in the selected time range if the user clicks on the sort button
        expr: addSortPipeToQuery(q, sortOrder),
        maxLines: q.maxLines ?? this.maxLines,
      }
    });

    // if step is defined, use it as the request interval to set the width of bars correctly
    request.intervalMs = queries[0]?.step ? getMillisecondsFromDuration(queries[0]?.step) : request.intervalMs;
    request.targets = queries;

    if (request.liveStreaming) {
      return this.runLiveQueryThroughBackend(request);
    }

    return this.runQuery(request);
  }

  runQuery(fixedRequest: DataQueryRequest<Query>) {
    return super
      .query(fixedRequest)
      .pipe(
        map((response) => transformBackendResult(
          response,
          fixedRequest,
          this.derivedFields ?? [],
          this.getActiveLevelRules()
        ))
      );
  }

  toggleQueryFilter(query: Query, filter: ToggleFilterAction): Query {
    let expression = query.expr ?? '';

    if (!filter.options?.key || !filter.options?.value) {
      return { ...query, expr: expression };
    }

    const value = escapeLabelValueInSelector(filter.options.value);
    const hasFilter = queryHasFilter(expression, filter.options.key, value)

    if (hasFilter) {
      expression = removeLabelFromQuery(expression, filter.options.key, value);
    }

    const isFilterFor = filter.type === FilterActionType.FILTER_FOR;
    const isFilterOut = filter.type === FilterActionType.FILTER_OUT;

    if ((isFilterFor && !hasFilter) || isFilterOut) {
      const operator = isFilterFor ? '=' : '!=';
      expression = addLabelToQuery(expression, { key: filter.options.key, value, operator });
    }

    return { ...query, expr: expression };
  }

  queryHasFilter(query: Query, filter: QueryFilterOptions): boolean {
    let expression = query.expr ?? '';
    return queryHasFilter(expression, filter.key, filter.value, "=");
  }

  applyTemplateVariables(target: Query, scopedVars: ScopedVars, adhocFilters?: AdHocVariableFilter[]): Query {
    const { __auto, __interval, __interval_ms, __range, __range_s, __range_ms, ...rest } = scopedVars || {};

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
      expr: this.interpolateString(target.expr, variables),
      extraFilters: this.getExtraFilters(adhocFilters),
    };
  }

  getExtraFilters(adhocFilters?: AdHocVariableFilter[], initialExpr = ''): string | undefined {
    if (!adhocFilters) {
      return;
    }

    const expr = adhocFilters.reduce((acc: string, filter: AdHocVariableFilter) => {
      return addLabelToQuery(acc, filter);
    }, initialExpr);

    return returnVariables(expr);
  }

  interpolateQueryExpr(value: any, _variable: any) {
    if (typeof value === 'string' && value) {
      value = [value];
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? `$_StartMultiVariable_${value.join("_separator_")}_EndMultiVariable` : "";
    }

    return value;
  }

  interpolateVariablesInQueries(queries: Query[], scopedVars: ScopedVars, filters?: AdHocVariableFilter[]): Query[] {
    let expandedQueries = queries;
    if (queries && queries.length) {
      expandedQueries = queries.map((query) => ({
        ...query,
        datasource: this.getRef(),
        expr: this.interpolateString(query.expr, scopedVars),
        interval: this.templateSrv.replace(query.interval, scopedVars),
        extraFilters: this.getExtraFilters(filters),
      }));
    }
    return expandedQueries;
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

  async getTagKeys(options?: DataSourceGetTagKeysOptions<Query>): Promise<MetricFindValue[]> {
    const list = await this.languageProvider?.getFieldList({
      type: FilterFieldType.FieldName,
      timeRange: options?.timeRange,
      limit: DEFAULT_FIELD_DISPLAY_VALUES_LIMIT,
    }, this.customQueryParameters)
    return list
      ? list.map(({ value }) => ({ text: value || " " }))
      : []
  }

  async getTagValues(options: DataSourceGetTagValuesOptions<Query>): Promise<MetricFindValue[]> {
    const list = await this.languageProvider?.getFieldList({
      type: FilterFieldType.FieldValue,
      timeRange: options.timeRange,
      limit: DEFAULT_FIELD_DISPLAY_VALUES_LIMIT,
      field: options.key,
    }, this.customQueryParameters)
    return list
      ? list.map(({ value }) => ({ text: value || " " }))
      : []
  }

  isAllOption(variable: TypedVariableModel): boolean {
    const value = 'current' in variable && variable?.current?.value;
    if (!value) {
      return false;
    }

    if (typeof value === 'string') {
      return value === VARIABLE_ALL_VALUE || value === TEXT_FILTER_ALL_VALUE;
    }

    return Array.isArray(value) ? value.includes(VARIABLE_ALL_VALUE) : false;
  }

  /**
   * Replaces all occurrences of a variable in the query expression with the following priority:
   *  1. Custom All Value
   *  2. list of variables (if query defined)
   *  3. default '*' and '.*' for regex
   *
   * @param {string} queryExpr - The query expression where the variable needs to be replaced.
   * @param {QueryVariableModel} variable - The variable model containing the variable name, options, and allValue.
   * @return {string} - The modified query expression with the variable replaced by its corresponding values or patterns.
   */
  replaceAllOption(queryExpr: string, variable: QueryVariableModel): string {
    const variableName = variable.name;

    // Check if the variable is modified to filter values with query | regexp | allowCustomValue.
    // In this case, we need to use a list of options for allValue and regexpAllValue
    const isModifiedAllOption = variable.query?.query || variable.allowCustomValue || variable.regex;
    let allValue = variable.allValue;
    let regexpAllValue = variable.allValue;
    if (!allValue && isModifiedAllOption) {
      const values = variable.options.map(option => option.value).flat(1);
      allValue = values.map(value => `"${value}"`).join(',');
      regexpAllValue = `(${values.join('|')})`;
    } else if (!allValue) {
      allValue = '*';
      regexpAllValue = '.*';
    }

    queryExpr = queryExpr.replaceAll(`~"$${variableName}"`, `~"${regexpAllValue}"`);
    queryExpr = queryExpr.replaceAll(`$${variableName}`, allValue);
    return queryExpr;
  }

  replaceOperatorsToInForMultiQueryVariables(expr: string) {
    const variables = this.templateSrv.getVariables();
    const fieldValuesVariables = variables.filter(v => v.type === 'query' && v.query.type === 'fieldValue' && v.multi || this.isAllOption(v)) as QueryVariableModel[];
    let result = expr;
    for (let variable of fieldValuesVariables) {
      result = removeDoubleQuotesAroundVar(result, variable.name);
      result = replaceOperatorWithIn(result, variable.name);
      if (this.isAllOption(variable)) {
        result = this.replaceAllOption(result, variable);
      }
    }
    return result;
  }

  interpolateString(string: string, scopedVars?: ScopedVars) {
    const exprWithReplacedOperators = this.replaceOperatorsToInForMultiQueryVariables(string);
    const expr = this.templateSrv.replace(exprWithReplacedOperators, scopedVars, this.interpolateQueryExpr);
    return this.replaceMultiVariables(expr)
  }

  private replaceMultiVariables(input: string): string {
    const multiVariablePattern = /\$_StartMultiVariable_(.+?)_EndMultiVariable?/g;

    return input.replace(multiVariablePattern, (match, valueList: string, offset) => {
      const values = valueList.split('_separator_');

      const queryBeforeOffset = input.slice(0, offset);
      const precedingChars = queryBeforeOffset.replace(/\s+/g, '').slice(-3);

      if (isRegExpOperatorInLastFilter(queryBeforeOffset)) {
        return `(${values.join("|")})`;
      } else if (precedingChars.includes("in(")) {
        return values.map(value => JSON.stringify(value)).join(",");
      }
      return values.join(" OR ");
    });
  }

  private async processMetricFindQuery(query: VariableQuery, timeRange?: TimeRange): Promise<MetricFindValue[]> {
    const list = await this.languageProvider?.getFieldList({
      type: query.type,
      timeRange,
      field: query.field,
      query: query.query,
      limit: query.limit,
    }, this.customQueryParameters);
    return (list ? list.map(({ value }) => ({ text: value })) : [])
  }

  getQueryBuilderLimits(key: FilterFieldType): number {
    return this.queryBuilderLimits?.[key] || 0;
  }

  private runLiveQueryThroughBackend(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const observables = request.targets.map((query) => {
      return getGrafanaLiveSrv().getDataStream({
        addr: {
          scope: LiveChannelScope.DataSource,
          namespace: this.uid,
          path: `${request.requestId}/${query.refId}`,
          data: {
            ...query,
          },
        },
      }).pipe(map((response) => {
        return {
          data: response.data || [],
          key: `victoriametrics-logs-datasource-${request.requestId}-${query.refId}`,
          state: LoadingState.Streaming,
        };
      }));
    });

    return merge(...observables);
  }

  getSupplementaryRequest(
    type: SupplementaryQueryType,
    request: DataQueryRequest<Query>,
    options?: SupplementaryQueryOptions
  ): DataQueryRequest<Query> | undefined {
    const logsVolumeOption = { ...options, type }
    const logsVolumeRequest = cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((query) => this.getSupplementaryQuery(logsVolumeOption, query, logsVolumeRequest))
      .filter((query): query is Query => !!query);

    if (!targets.length) {
      return undefined;
    }

    return { ...logsVolumeRequest, targets };
  }

  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume, SupplementaryQueryType.LogsSample];
  }

  getSupplementaryQuery(options: SupplementaryQueryOptions, query: Query, request: DataQueryRequest<Query>): Query | undefined {
    switch (options.type) {
      case SupplementaryQueryType.LogsVolume:
        const totalSeconds = request.range.to.diff(request.range.from, "second");
        const step = Math.ceil(totalSeconds / LOGS_VOLUME_BARS) || "";

        const fields = this.getActiveLevelRules().map(r => r.field)
        const uniqFields = Array.from(new Set([...fields, "level"]));

        return {
          ...query,
          step: `${step}s`,
          fields: uniqFields,
          queryType: QueryType.Hits,
          refId: `${REF_ID_STARTER_LOG_VOLUME}${query.refId}`,
          supportingQueryType: SupportingQueryType.LogsVolume,
        };

      case SupplementaryQueryType.LogsSample:
        return {
          ...query,
          queryType: QueryType.Instant,
          refId: `${REF_ID_STARTER_LOG_SAMPLE}${query.refId}`,
          supportingQueryType: SupportingQueryType.LogsSample,
          maxLines: this.maxLines
        };

      default:
        return undefined;
    }
  }

  getDataProvider(
    type: SupplementaryQueryType,
    request: DataQueryRequest<Query>
  ): Observable<DataQueryResponse> | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(type)) {
      return undefined;
    }

    const newRequest = this.getSupplementaryRequest(type, request)
    if (!newRequest) {
      return
    }

    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        return queryLogsVolume(this, newRequest);
      default:
        return undefined
    }
  }

  getQueryDisplayText(query: Query): string {
    return (query.expr || '');
  }

  getActiveLevelRules(): LogLevelRule[] {
    return (this.logLevelRules || []).filter(r => r.enabled !== false);
  }

  getLogRowContext = async (
    row: LogRowModel,
    options?: LogRowContextOptions,
    query?: DataQuery
  ): Promise<{ data: DataFrame[] }> => {
    const contextRequest = this.makeLogContextDataRequest(row, options);
    return lastValueFrom(this.runQuery(contextRequest));
  };

  private prepareLogContextQueryExpr = (row: LogRowModel): string => {
    let streamId = "";

    if (row.labels[LABEL_STREAM_ID]) {
      // Explore View
      streamId = row.labels[LABEL_STREAM_ID]
    } else {
      // Dashboard View
      const transformedLabels: Labels = {};
      Object.values(row.labels).forEach((label) => {
        const [key, value] = label.split(':');
        const cleanedKey = key.trim();
        transformedLabels[cleanedKey] = value.trim().replace(/"/g, '');
      });
      streamId = transformedLabels[LABEL_STREAM_ID];
    }

    return addLabelToQuery('', { key: LABEL_STREAM_ID, value: streamId, operator: '' });
  };

  private makeLogContextDataRequest = (row: LogRowModel, options?: LogRowContextOptions): DataQueryRequest<Query> => {
    const direction = options?.direction || LogRowContextQueryDirection.Backward;

    const query: Query = {
      expr: this.prepareLogContextQueryExpr(row),
      refId: `${REF_ID_STARTER_LOG_CONTEXT_QUERY}${row.dataFrame.refId}-${options?.direction}`
    };

    const range = this.createContextTimeRange(row.timeEpochMs, direction);

    const interval = rangeUtil.calculateInterval(range, 1);

    return {
      app: CoreApp.Explore,
      interval: interval.interval,
      intervalMs: interval.intervalMs,
      range: range,
      requestId: `${REF_ID_STARTER_LOG_CONTEXT_REQUEST}${row.dataFrame.refId}-${options?.direction}`,
      scopedVars: {},
      startTime: Date.now(),
      targets: [query],
      timezone: 'UTC'
    };
  };

  private createContextTimeRange = (rowTimeEpochMs: number, direction?: LogRowContextQueryDirection): TimeRange => {
    const offset = 2 * 60 * 60 * 1000;  // 2h
    const overlap = 1000;

    const timeRange =
      direction === LogRowContextQueryDirection.Backward
        ? {
          from: toUtc(rowTimeEpochMs - offset),
          to: toUtc(rowTimeEpochMs + overlap)
        }
        : {
          from: toUtc(rowTimeEpochMs),
          to: toUtc(rowTimeEpochMs + offset) // Add 1 second to avoid missing results
        };

    return { ...timeRange, raw: timeRange };
  }
}
