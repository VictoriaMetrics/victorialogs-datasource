import { getDefaultTimeRange, LanguageProvider, TimeRange, } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { VictoriaLogsDatasource } from './datasource';
import { FieldHits, FilterFieldType } from "./types";

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

enum HitsValueType {
  NUMBER = 'number',
  DATE = 'date',
  STRING = 'string'
}

export default class LogsQlLanguageProvider extends LanguageProvider {
  declare startTask: Promise<any>;
  datasource: VictoriaLogsDatasource;
  cacheSize: number;
  cacheValues: Map<string, FieldHits[]>

  constructor(datasource: VictoriaLogsDatasource, initialValues?: Partial<LogsQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.cacheSize = 100;
    this.cacheValues = new Map<string, FieldHits[]>();

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

  async getFieldList(options: FetchFieldsOptions): Promise<FieldHits[]> {
    if (options.type === FilterFieldType.FieldValue && !options.field) {
      return [];
    }

    const params: FieldsRequestParams = {
      query: options.query || "*",
      ...this.getTimeRangeParams(options.timeRange),
    };
    if (options.type === FilterFieldType.FieldValue) {
      params.field = options.field;
    }

    if (options.limit && (options.limit > 0) && (options.type === FilterFieldType.FieldValue)) {
      params.limit = options.limit;
    }

    const url = options.type === FilterFieldType.FieldName ? 'select/logsql/field_names' : `select/logsql/field_values`;
    const key = `${url}/${Object.values(params).join('/')}`;

    if (this.cacheValues.has(key)) {
      return this.cacheValues.get(key)!;
    }

    if (this.cacheValues.size >= this.cacheSize) {
      const firstKey = this.cacheValues.keys().next().value;
      this.cacheValues.delete(firstKey);
    }

    const result = await this.request(url, [], params, { method: 'POST' }) as FieldHits[];
    const sortedResult = sortFieldHits(result);
    this.cacheValues.set(key, sortedResult);
    return sortedResult;
  }

  getTimeRangeParams(timeRange?: TimeRange) {
    const range = timeRange ?? getDefaultTimeRange();
    return {
      start: range.from.startOf('day').valueOf(),
      end: range.to.endOf('day').valueOf()
    }
  }
}

function determineType(value: string): HitsValueType {
  if (!isNaN(Number(value))) {
    return HitsValueType.NUMBER;
  }
  if (!isNaN(Date.parse(value))) {
    return HitsValueType.DATE;
  }
  return HitsValueType.STRING;
}

function getArrayType(data: FieldHits[]): HitsValueType {
  const types = new Set(data.map(item => determineType(item.value)));
  return types.size === 1 ? Array.from(types)[0] : HitsValueType.STRING;
}

function sortFieldHits(data: FieldHits[]): FieldHits[] {
  const arrayType = getArrayType(data);

  return data.sort((a, b) => {
    switch (arrayType) {
      case HitsValueType.NUMBER:
        return Number(a.value) - Number(b.value);
      case HitsValueType.DATE:
        return new Date(a.value).getTime() - new Date(b.value).getTime();
      case HitsValueType.STRING:
      default:
        return a.value.localeCompare(b.value);
    }
  });
}
