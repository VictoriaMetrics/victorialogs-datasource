import { cloneDeep } from 'lodash';
import { ReactNode } from 'react';
import { finalize, map, merge, Observable } from 'rxjs';

import {
  AdHocVariableFilter,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  DataSourceInstanceSettings,
  DataSourceWithLogsContextSupport,
  DEFAULT_FIELD_DISPLAY_VALUES_LIMIT,
  LegacyMetricFindQueryOptions,
  LiveChannelScope,
  LoadingState,
  LogRowContextOptions,
  LogRowModel,
  MetricFindValue,
  QueryVariableModel,
  ScopedVars,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
  TimeRange,
  TypedVariableModel,
} from '@grafana/data';
import { config, DataSourceWithBackend, getGrafanaLiveSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { correctMultiExactOperatorValueAll } from './LogsQL/multiExactOperator';
import { correctRegExpValueAll, doubleQuoteRegExp, isRegExpOperatorInLastFilter } from './LogsQL/regExpOperator';
import QueryEditor from './components/QueryEditor/QueryEditor';
import {
  buildStreamExtraFilters
} from './components/QueryEditor/StreamFilters/streamFilterUtils';
import { LogLevelRule } from './configuration/LogLevelRules/types';
import {
  buildPresetDerivedFields,
  buildPresetLogLevelRules,
  mergePresetDerivedFields,
  mergePresetLogLevelRules,
} from './configuration/OpenTelemetryPreset/preset-builder';
import { LOGS_LIMIT_DEFAULT, LOGS_LIMIT_HARD_CAP, TEXT_FILTER_ALL_VALUE, VARIABLE_ALL_VALUE } from './constants';
import { escapeLabelValueInSelector } from './languageUtils';
import LogsQlLanguageProvider from './language_provider';
import { LiveChannelPathProvider } from './live/LiveChannelPathProvider';
import { LogContextProvider } from './logContext/LogContextProvider';
import { LOGS_VOLUME_BARS, queryLogsVolume } from './logsVolumeLegacy';
import {
  addLabelToQuery,
  addSortPipeToQuery,
  getQueryFormat,
} from './modifyQuery';
import { removeDoubleQuotesAroundVar } from './parsing';
import { replaceOperatorWithIn, returnVariables } from './parsingUtils';
import { packLabelsToLine, shouldPackLabelsToLine, transformBackendResult } from './transformers';
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
  StreamFilterState,
  SupportingQueryType,
  Tenant,
  TenantHeaderNames,
  ToggleFilterAction,
  VariableQuery,
} from './types';
import {
  resolveAdHocFilters,
  serializeChipsForBackend,
} from './utils/query/adHocFilters';
import { formatOffsetDuration, getMillisecondsFromDuration } from './utils/timeUtils';
import { VariableSupport } from './variableSupport/VariableSupport';

export { resolveAdHocFiltersMode } from './utils/query/adHocFilters';

export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
export const REF_ID_STARTER_LOG_SAMPLE = 'log-sample-';

export class VictoriaLogsDatasource
  extends DataSourceWithBackend<Query, Options>
  implements DataSourceWithLogsContextSupport {
  id: number | undefined;
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
  logContextProvider: LogContextProvider;
  private readonly liveChannelPathProvider = new LiveChannelPathProvider();

  constructor(
    instanceSettings: DataSourceInstanceSettings<Options>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    languageProvider?: LogsQlLanguageProvider
  ) {
    super(instanceSettings);

    const settingsData = instanceSettings.jsonData || {};
    this.id = instanceSettings.id;
    this.uid = instanceSettings.uid;
    this.url = instanceSettings.url!;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.httpMethod = settingsData.httpMethod || 'POST';
    this.maxLines = Math.min(parseInt(settingsData.maxLines ?? '0', 10) || LOGS_LIMIT_DEFAULT, LOGS_LIMIT_HARD_CAP);
    const userDerivedFields = settingsData.derivedFields || [];
    const userLogLevelRules = settingsData.logLevelRules || [];
    const preset = settingsData.otelPreset;
    if (preset?.enabled && preset.detection) {
      this.derivedFields = mergePresetDerivedFields(userDerivedFields, buildPresetDerivedFields(preset));
      this.logLevelRules = mergePresetLogLevelRules(userLogLevelRules, buildPresetLogLevelRules(preset));
    } else {
      this.derivedFields = userDerivedFields;
      this.logLevelRules = userLogLevelRules;
    }
    this.customQueryParameters = new URLSearchParams(settingsData.customQueryParameters);
    this.languageProvider = languageProvider ?? new LogsQlLanguageProvider(this);
    this.annotations = {
      QueryEditor: QueryEditor,
    };
    this.variables = new VariableSupport(this);
    this.queryBuilderLimits = settingsData.queryBuilderLimits;
    this.multitenancyHeaders = this.parseMultitenancyHeaders(settingsData.multitenancyHeaders);
    this.logContextProvider = new LogContextProvider(this);
  }

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const timezoneOffset = formatOffsetDuration(request.timezone, request.range.from.utcOffset());
    const queries: Query[] = request.targets
      .filter((q) => q.expr || config.publicDashboardAccessToken !== '')
      .map(({ templateBuilder, ...q }) => {
        return {
          ...q,
          // to backend sort for limited data to show first logs in the selected time range if the user clicks on the sort button
          expr: addSortPipeToQuery(q, request.app, request.liveStreaming),
          maxLines: Math.min(q.maxLines ?? this.maxLines, LOGS_LIMIT_HARD_CAP),
          timezoneOffset,
          format: getQueryFormat(q.expr),
          step: this.templateSrv.replace(q.step, request.scopedVars),
        };
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
        map((response) =>
          transformBackendResult(
            response,
            fixedRequest,
            this.derivedFields ?? [],
            this.getActiveLevelRules(),
            (expr) => this.interpolateString(expr, fixedRequest.scopedVars)
          )
        )
      );
  }

  toggleQueryFilter(query: Query, filter: ToggleFilterAction): Query {
    if (!filter.options?.key || !filter.options?.value) {
      return query;
    }

    const { key } = filter.options;
    const value = escapeLabelValueInSelector(filter.options.value);
    const current = query.adHocFilters ?? [];
    const exists = current.some((f) => f.key === key && f.value === value);

    let next = exists ? current.filter((f) => !(f.key === key && f.value === value)) : current;

    const isFilterFor = filter.type === FilterActionType.FILTER_FOR;
    const isFilterOut = filter.type === FilterActionType.FILTER_OUT;

    if ((isFilterFor && !exists) || isFilterOut) {
      next = [...next, { key, value, operator: isFilterFor ? '=' : '!=' }];
    }

    const expr = query.expr || (next.length ? '*' : '');
    return { ...query, expr, adHocFilters: next.length ? next : undefined };
  }

  // The `hasToggleableQueryFiltersSupport` type guard checks for both
  // `toggleQueryFilter` and `queryHasFilter` on the datasource — without this
  // method the Logs viewer hides the "Filter for / Filter out" icons next to
  // log field values
  queryHasFilter(query: Query, filter: QueryFilterOptions): boolean {
    const value = escapeLabelValueInSelector(filter.value);
    return (query.adHocFilters ?? []).some((f) => f.key === filter.key && f.value === value);
  }

  filterQuery(query: Query): boolean {
    if (query.hide || query.expr === '') {
      return false;
    }
    return true;
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

    const interpolated = this.interpolateString(target.expr, variables);
    const rules = this.getActiveLevelRules();
    const { expr, chips } = resolveAdHocFilters(target, interpolated, adhocFilters, rules);

    return {
      ...target,
      legendFormat: this.templateSrv.replace(target.legendFormat, rest),
      expr,
      extraFilters: serializeChipsForBackend(chips, rules),
      extraStreamFilters: this.getExtraStreamFilters(target.streamFilters, scopedVars),
      // Backend protocol uses `extraFilters` (string); the structured array is editor-only
      adHocFilters: undefined,
    };
  }

  getExtraFilters(adhocFilters?: AdHocVariableFilter[], initialExpr = ''): string | undefined {
    if (!adhocFilters?.length) {
      return initialExpr || undefined;
    }
    const expr = adhocFilters.reduce<string>((acc, filter) => addLabelToQuery(acc, filter), initialExpr);
    return returnVariables(expr) || undefined;
  }

  getExtraStreamFilters(streamFilters: StreamFilterState[] | undefined, scopedVars: ScopedVars): string | undefined {
    if (!streamFilters) {
      return undefined;
    }

    return this.interpolateString(buildStreamExtraFilters(streamFilters), scopedVars) || undefined;
  }

  interpolateQueryExpr(value: any, _variable: any) {
    if (typeof value === 'string' && value) {
      value = [value];
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? `$_StartMultiVariable_${value.join('_separator_')}_EndMultiVariable` : '';
    }

    return value;
  }

  interpolateVariablesInQueries(queries: Query[], scopedVars: ScopedVars, filters?: AdHocVariableFilter[]): Query[] {
    if (!queries?.length) {
      return queries;
    }

    const rules = this.getActiveLevelRules();
    return queries.map((query) => {
      const interpolated = this.interpolateString(query.expr, scopedVars);
      const { expr, chips } = resolveAdHocFilters(query, interpolated, filters, rules);

      return {
        ...query,
        datasource: this.getRef(),
        expr,
        interval: this.templateSrv.replace(query.interval, scopedVars),
        // Keep chips on the target so Explore can render them; applyTemplateVariables
        // will serialise them into `extraFilters` at query-run time.
        adHocFilters: chips,
        extraStreamFilters: this.getExtraStreamFilters(query.streamFilters, scopedVars),
      };
    });
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
      query: this.buildNarrowingQuery(options?.filters),
    }, this.customQueryParameters);
    return list
      ? list.map(({ value }) => ({ text: value || ' ' }))
      : [];
  }

  async getTagValues(options: DataSourceGetTagValuesOptions<Query>): Promise<MetricFindValue[]> {
    // Exclude filters on the queried key so its own value can still be changed
    const otherFilters = options.filters?.filter((f) => f.key !== options.key);
    const list = await this.languageProvider?.getFieldList({
      type: FilterFieldType.FieldValue,
      timeRange: options.timeRange,
      limit: DEFAULT_FIELD_DISPLAY_VALUES_LIMIT,
      field: options.key,
      query: this.buildNarrowingQuery(otherFilters),
    }, this.customQueryParameters);
    return list
      ? list.map(({ value }) => ({ text: value || ' ' }))
      : [];
  }

  /**
   * Builds a LogsQL query that narrows field/value lookups to the logs matching the
   * already-selected Ad Hoc filters. Returns undefined when there are no filters so the
   * caller falls back to the default `*` (all logs)
   */
  private buildNarrowingQuery(filters?: AdHocVariableFilter[]): string | undefined {
    const expr = this.getExtraFilters(filters);
    if (!expr) {
      return undefined;
    }
    // Resolve template variables (incl. multi-value) before hitting the VL endpoint directly
    return this.interpolateString(expr);
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

  replaceOperatorsToInForMultiQueryVariables(expr: string) {
    const variables = this.templateSrv.getVariables();
    const fieldValuesVariables = variables.filter(v => v.type === 'query' && v.query.type === 'fieldValue' && v.multi || this.isAllOption(v)) as QueryVariableModel[];
    let result = expr;
    for (const variable of fieldValuesVariables) {
      result = removeDoubleQuotesAroundVar(result, variable.name);
      result = replaceOperatorWithIn(result, variable.name);
    }
    return result;
  }

  interpolateString(string: string, scopedVars?: ScopedVars) {
    let expr = this.replaceOperatorsToInForMultiQueryVariables(string);
    const variableNamesList = this.templateSrv.getVariables().map(v => v.name);
    expr = doubleQuoteRegExp(expr, variableNamesList);
    expr = this.templateSrv.replace(expr, scopedVars, this.interpolateQueryExpr);
    expr = this.replaceMultiVariables(expr);
    expr = correctRegExpValueAll(expr);
    expr = correctMultiExactOperatorValueAll(expr);
    return expr;
  }

  private replaceMultiVariables(input: string): string {
    const multiVariablePattern = /\$_StartMultiVariable_(.+?)_EndMultiVariable?/g;

    return input.replace(multiVariablePattern, (match, valueList: string, offset) => {
      const values = valueList.split('_separator_');

      const queryBeforeOffset = input.slice(0, offset);
      const precedingChars = queryBeforeOffset.replace(/\s+/g, '').slice(-3);

      if (isRegExpOperatorInLastFilter(queryBeforeOffset)) {
        return `(${values.join('|')})`;
      } else if (precedingChars.includes('in(')) {
        return values.map(value => JSON.stringify(value)).join(',');
      }
      return values.join(' OR ');
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
    return (list ? list.map(({ value }) => ({ text: value })) : []);
  }

  getQueryBuilderLimits(key: FilterFieldType): number {
    return this.queryBuilderLimits?.[key] || 0;
  }

  private runLiveQueryThroughBackend(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const observables = request.targets.map((query) => {
      // The path must change when the query content changes and stay stable
      const path = this.liveChannelPathProvider.getPath(request.requestId, query);
      return getGrafanaLiveSrv()
        .getDataStream({
          addr: {
            scope: LiveChannelScope.DataSource,
            // @ts-expect-error - for the Grafana with React version < 19,
            // the interface of the Live feature expects the `stream` field instead of the `namespace`,
            // so we need to send both for compatibility with older versions
            namespace: this.uid,
            stream: this.uid,
            path,
            data: {
              ...query,
            },
          },
        })
        .pipe(
          map((response) => {
            const frames: DataFrame[] = response.data || [];
            return {
              // live frames skip transformBackendResult, so the packJson option is applied here
              data: shouldPackLabelsToLine(query) ? frames.map(packLabelsToLine) : frames,
              key: `victoriametrics-logs-datasource-${request.requestId}-${query.refId}`,
              state: LoadingState.Streaming,
            };
          }),
          // Evict the per-channel state once the stream is torn down, so
          // request-scoped keys do not accumulate over long Explore sessions
          finalize(() => this.liveChannelPathProvider.release(request.requestId, query.refId, path))
        );
    });

    return merge(...observables);
  }

  getSupplementaryRequest(
    type: SupplementaryQueryType,
    request: DataQueryRequest<Query>,
    options?: SupplementaryQueryOptions
  ): DataQueryRequest<Query> | undefined {
    const logsVolumeOption = { ...options, type };
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
    if (query.hide) {
      return undefined;
    }

    switch (options.type) {
      case SupplementaryQueryType.LogsVolume: {
        // Logs volume histogram is only meaningful for raw log queries
        // Skip it for stats query types (StatsRange/Stats) — their main response already
        // produces the chart, so the extra /select/logsql/hits call is redundant
        if (query.queryType !== QueryType.Instant) {
          return undefined;
        }

        const totalSeconds = request.range.to.diff(request.range.from, 'second');
        const step = Math.ceil(totalSeconds / LOGS_VOLUME_BARS) || '';

        const fields = this.getActiveLevelRules().map(r => r.field).filter(Boolean);
        const uniqFields = Array.from(new Set([...fields, 'level']));

        return {
          ...query,
          step: `${step}s`,
          fields: uniqFields,
          queryType: QueryType.Hits,
          refId: `${REF_ID_STARTER_LOG_VOLUME}${query.refId}`,
          supportingQueryType: SupportingQueryType.LogsVolume,
          timezoneOffset: formatOffsetDuration(request.timezone, request.range.from.utcOffset()),
        };
      }
      case SupplementaryQueryType.LogsSample:
        // Logs sample is only meaningful for metric queries — it shows raw log lines
        // behind an aggregated chart. For raw log queries it would just duplicate the main request
        if (query.queryType !== QueryType.StatsRange && query.queryType !== QueryType.Stats) {
          return undefined;
        }

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

    const newRequest = this.getSupplementaryRequest(type, request);
    if (!newRequest) {
      return;
    }

    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        return queryLogsVolume(this, newRequest);
      default:
        return undefined;
    }
  }

  getQueryDisplayText(query: Query): string {
    return query.expr || '';
  }

  getActiveLevelRules(): LogLevelRule[] {
    return (this.logLevelRules || []).filter(r => r.enabled !== false);
  }

  getLogRowContext = async (
    row: LogRowModel,
    options?: LogRowContextOptions,
  ): Promise<{ data: DataFrame[] }> => {
    return this.logContextProvider.getLogRowContext(row, options);
  };

  getLogRowContextQuery = async (
    row: LogRowModel,
    options?: LogRowContextOptions
  ): Promise<Query | null> => {
    return this.logContextProvider.getLogRowContextQuery(row, options);
  };

  getLogRowContextUi = (row: LogRowModel, runContextQuery?: () => void): ReactNode => {
    return this.logContextProvider.getLogRowContextUi(row, runContextQuery);
  };

  async fetchTenantIds(): Promise<string[]> {
    try {
      const res = await this.postResource<{ hint: string } | Tenant[]>('select/tenant_ids', {});

      if (!Array.isArray(res)) {
        return [];
      }

      const tenantSet = new Set<string>();
      res.forEach((item: Tenant) => {
        tenantSet.add(`${item.account_id}:${item.project_id}`);
      });

      return Array.from(tenantSet);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      return [];
    }
  }

  parseMultitenancyHeaders(multitenancyHeaders?: Partial<Record<TenantHeaderNames, string>>): MultitenancyHeaders {
    const formatTenantId = (value: string | number | undefined): string => {
      if (value === undefined || value === '') {
        return '0';
      }
      const num = Number(value);
      return Number.isInteger(num) ? String(num) : '0';
    };

    return {
      [TenantHeaderNames.AccountID]: formatTenantId(multitenancyHeaders?.AccountID),
      [TenantHeaderNames.ProjectID]: formatTenantId(multitenancyHeaders?.ProjectID),
    };
  }
}

