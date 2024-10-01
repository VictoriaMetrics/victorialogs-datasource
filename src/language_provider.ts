import { getDefaultTimeRange, LanguageProvider, TimeRange, } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { VictoriaLogsDatasource } from './datasource';
import { FiledHits, FilterFieldType } from "./types";

interface FetchFieldsOptions {
  type: FilterFieldType;
  query?: string;
  field?: string;
  timeRange?: TimeRange;
  limit?: number;
}

interface FieldsRequestParams {
  query: string;
  start: number;
  end: number;
  limit?: number;
  field?: string;
}

export default class LogsQlLanguageProvider extends LanguageProvider {
  declare startTask: Promise<any>;
  datasource: VictoriaLogsDatasource;
  cacheSize: number;
  cacheValues: Map<string, FiledHits[]>

  constructor(datasource: VictoriaLogsDatasource, initialValues?: Partial<LogsQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.cacheSize = 100;
    this.cacheValues = new Map<string, FiledHits[]>();

    Object.assign(this, initialValues);
  }

  request = async (url: string, defaultValue: any, params = {}, options?: Partial<BackendSrvRequest>): Promise<any> => {
    try {
      const res = await this.datasource.metadataRequest({ url, params, options });
      return res.data?.values;
    } catch (error) {
      console.error(error);
    }

    return defaultValue;
  };

  start = async (): Promise<any[]> => {
    return Promise.all([]);
  };

  async getFieldList(options: FetchFieldsOptions): Promise<FiledHits[]> {
    if (options.type === FilterFieldType.Value && !options.field) {
      return [];
    }

    const params: FieldsRequestParams = {
      query: options.query || "*",
      ...this.getTimeRangeParams(options.timeRange),
    };
    if (options.type === FilterFieldType.Value) {
      params.field = options.field;
    }

    if (options.limit && (options.limit > 0) && (options.type === FilterFieldType.Value)) {
      params.limit = options.limit;
    }

    const url = options.type === FilterFieldType.Name ? 'select/logsql/field_names' : `select/logsql/field_values`;
    const key = `${url}/${Object.values(params).join('/')}`;

    if (this.cacheValues.has(key)) {
      return this.cacheValues.get(key)!;
    }

    if (this.cacheValues.size >= this.cacheSize) {
      const firstKey = this.cacheValues.keys().next().value;
      this.cacheValues.delete(firstKey);
    }

    const result = await this.request(url, [], params, { method: 'POST' });
    this.cacheValues.set(key, result);
    return result;
  }

  getTimeRangeParams(timeRange?: TimeRange) {
    const range = timeRange ?? getDefaultTimeRange();
    return {
      start: range.from.startOf('day').valueOf(),
      end: range.to.endOf('day').valueOf()
    }
  }
}
