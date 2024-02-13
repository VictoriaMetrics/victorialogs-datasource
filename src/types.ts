import { DataFrame, DataSourceJsonData, KeyValue, QueryEditorProps } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { VictoriaLogsDatasource } from "./datasource";

export interface Options extends DataSourceJsonData {
  maxLines?: string;
  // derivedFields?: DerivedFieldConfig[];
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
  Instant = 'instant',
  Range = 'range',
  Stream = 'stream',
}

export interface QueryFromSchema extends DataQuery {
  expr: string;
  legendFormat?: string;
  maxLines?: number;
  step?: string;
}

export interface Query extends QueryFromSchema {
  direction?: QueryDirection;
  supportingQueryType?: SupportingQueryType;
  queryType?: QueryType;
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

