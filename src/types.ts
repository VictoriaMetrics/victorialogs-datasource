import { DataFrame, DataSourceJsonData, KeyValue, QueryEditorProps } from '@grafana/data';
import { BackendSrvRequest } from "@grafana/runtime";
import { DataQuery } from '@grafana/schema';

import { VictoriaLogsDatasource } from "./datasource";

export interface Options extends DataSourceJsonData {
  maxLines?: string;
  httpMethod?: string;
  customQueryParameters?: string;
  queryBuilderLimits?: QueryBuilderLimits;
  derivedFields?: DerivedFieldConfig[];
  // alertmanager?: string;
  // keepCookies?: string[];
  // predefinedOperations?: string;
}

export enum QueryDirection {
  Backward = 'backward',
  Forward = 'forward',
}

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

export interface QueryFromSchema extends DataQuery {
  editorMode?: QueryEditorMode;
  expr: string;
  legendFormat?: string;
  maxLines?: number;
  step?: string;
}

export interface Query extends QueryFromSchema {
  direction?: QueryDirection;
  supportingQueryType?: SupportingQueryType;
  queryType?: QueryType;
  field?: string; // groups the results by the specified field value for /select/logsql/hits
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

export interface QueryFilterOptions extends KeyValue<string> {
}

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
  pipes: string[]//PipeVisualQuery[];
}

export interface RequestArguments {
  url: string;
  params?: Record<string, string>;
  options?: Partial<BackendSrvRequest>;
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
