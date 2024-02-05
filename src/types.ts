import { DataSourceJsonData, QueryEditorProps } from '@grafana/data';
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

export enum QueryEditorMode {
  Code = 'code',
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
