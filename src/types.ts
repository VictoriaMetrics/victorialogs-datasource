import { DataFrame, DataSourceJsonData, KeyValue, QueryEditorProps } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { LogLevelRule } from './configuration/LogLevelRules/types';
import { VictoriaLogsDatasource } from './datasource';

export interface Options extends DataSourceJsonData {
  maxLines?: string;
  httpMethod?: string;
  customQueryParameters?: string;
  queryBuilderLimits?: QueryBuilderLimits;
  derivedFields?: DerivedFieldConfig[];
  // alertmanager?: string;
  // keepCookies?: string[];
  // predefinedOperations?: string;
  enableSecureSocksProxy?: boolean;
  logLevelRules?: LogLevelRule[];
  multitenancyHeaders?: Partial<Record<TenantHeaderNames, string>>;
  vmuiUrl?: string;
}

export const QUERY_DIRECTION = {
  asc: 'asc',
  desc: 'desc',
} as const;
export type QueryDirection = (typeof QUERY_DIRECTION)[keyof typeof QUERY_DIRECTION];

export enum SupportingQueryType {
  DataSample = 'dataSample',
  LogsSample = 'logsSample',
  LogsVolume = 'logsVolume',
}

export enum QueryType {
  Instant = 'instant', // /select/logsql/query
  Stats = 'stats', // /select/logsql/stats_query
  StatsRange = 'statsRange', // /select/logsql/stats_query_range
  Hits = 'hits', // /select/logsql/hits
}

export enum QueryEditorMode {
  Builder = 'builder',
  Code = 'code',
}

export interface Query extends DataQuery {
  editorMode?: QueryEditorMode;
  expr: string;
  legendFormat?: string;
  maxLines?: number;
  step?: string;
  extraFilters?: string;
  direction?: QueryDirection;
  supportingQueryType?: SupportingQueryType;
  queryType?: QueryType;
  /** for /select/logsql/query */
  interval?: string;
  /** groups the results by the specified field value for /select/logsql/hits */
  fields?: string[];
  /** timezone offset for bucket alignment in stats_query_range and hits endpoints (e.g. "2h", "-5h30m") */
  timezoneOffset?: string;
  /** if true, adhoc filters will be applied as the root filter, otherwise as an extra_filters */
  isApplyExtraFiltersToRootQuery?: boolean;
}

export type VictoriaLogsQueryEditorProps = QueryEditorProps<VictoriaLogsDatasource, Query, Options>;

export type DerivedFieldConfig = {
  matcherRegex: string;
  name: string;
  url?: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
  matcherType?: 'label' | 'regex';
};

export type QueryFilterOptions = KeyValue<string>;

export enum FilterActionType {
  FILTER_FOR = 'FILTER_FOR',
  FILTER_OUT = 'FILTER_OUT',
}

export interface ToggleFilterAction {
  type: FilterActionType;
  options: QueryFilterOptions;
  frame?: DataFrame;
}

export interface FilterVisualQuery {
  values: (string | FilterVisualQuery)[];
  operators: string[];
}

export interface PipeVisualQuery {
  type: string;
  args: string[];
}

export interface VisualQuery {
  filters: FilterVisualQuery;
  pipes: string[]; //PipeVisualQuery[];
}

export interface RequestArguments {
  url: string;
  params?: Record<string, string>;
  options?: Partial<BackendSrvRequest>;
}

export interface FieldHitsResponse {
  values: FieldHits[];
}

export interface FieldHits {
  value: string;
  hits: number;
}

export enum FilterFieldType {
  FieldName = 'fieldName',
  FieldValue = 'fieldValue'
}

export interface VariableQuery extends DataQuery {
  type: FilterFieldType;
  query?: string;
  field?: string;
  limit?: number;
}

export type QueryBuilderLimits = {
  [FilterFieldType.FieldValue]?: number;
  [FilterFieldType.FieldName]?: number;
};

export enum TenantHeaderNames {
  AccountID = 'AccountID',
  ProjectID = 'ProjectID',
}

export type MultitenancyHeaders = Record<TenantHeaderNames, string>;

export type Tenant = {
  account_id: string;
  project_id: string;
};
