import { getDefaultTimeRange, LanguageProvider, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from './datasource';
import { FieldHits, FieldHitsResponse, FilterFieldType } from './types';
import { LRUCache } from './utils/LRUCache';

interface FetchFieldsOptions {
  type: FilterFieldType;
  query?: string;
  field?: string;
  timeRange?: TimeRange;
  limit?: number;
  /** Substring filter applied server-side (supported by all field_names/field_values endpoints) */
  filter?: string;
}

enum HitsValueType {
  NUMBER = 'number',
  DATE = 'date',
  STRING = 'string',
}

export default class LogsQlLanguageProvider extends LanguageProvider {
  request!: (url: string, params?: any) => Promise<any>;
  declare startTask: Promise<any>;
  datasource: VictoriaLogsDatasource;
  cacheValues: LRUCache<FieldHits[]>;

  constructor(datasource: VictoriaLogsDatasource, initialValues?: Partial<LogsQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.cacheValues = new LRUCache<FieldHits[]>(100);

    Object.assign(this, initialValues);
  }

  start = async (): Promise<any[]> => {
    return Promise.all([]);
  };

  async getFieldList(options: FetchFieldsOptions, customParams?: URLSearchParams): Promise<FieldHits[]> {
    if (options.type === FilterFieldType.FieldValue && !options.field) {
      console.warn('getFieldList: field is required for FieldValue type');
      return [];
    }

    const urlParams = new URLSearchParams();
    if (customParams) {
      for (const [key, value] of customParams) {
        urlParams.append(key, value);
      }
    }

    urlParams.append('query', options.query || '*');

    if (options.filter) {
      urlParams.append('filter', options.filter);
    }

    const timeRange = this.getTimeRangeParams(options.timeRange);
    urlParams.append('start', timeRange.start.toString());
    urlParams.append('end', timeRange.end.toString());

    if (options.type === FilterFieldType.FieldValue && options.field) {
      urlParams.append('field', options.field);
    }

    if (options.limit && options.limit > 0 && options.type === FilterFieldType.FieldValue) {
      urlParams.append('limit', options.limit.toString());
    }

    const params = Object.fromEntries(urlParams);

    const url = options.type === FilterFieldType.FieldName ? 'select/logsql/field_names' : 'select/logsql/field_values';
    const key = `${url}?${urlParams.toString()}`;

    const cached = this.cacheValues.get(key);
    if (cached) {
      return cached;
    }

    const res = (await this.datasource.postResource(url, params)) as FieldHitsResponse;
    const result = (res?.values || []) as FieldHits[];
    const sortedResult = sortFieldHits(result);
    this.cacheValues.set(key, sortedResult);
    return sortedResult;
  }

  async getStreamFieldList(options: FetchFieldsOptions, customParams?: URLSearchParams): Promise<FieldHits[]> {
    if (options.type === FilterFieldType.FieldValue && !options.field) {
      console.warn('getStreamFieldList: field is required for FieldValue type');
      return [];
    }

    const urlParams = new URLSearchParams();
    if (customParams) {
      for (const [key, value] of customParams) {
        urlParams.append(key, value);
      }
    }

    urlParams.append('query', options.query || '*');

    if (options.filter) {
      urlParams.append('filter', options.filter);
    }

    const timeRange = this.getTimeRangeParams(options.timeRange);
    urlParams.append('start', timeRange.start.toString());
    urlParams.append('end', timeRange.end.toString());

    if (options.type === FilterFieldType.FieldValue && options.field) {
      urlParams.append('field', options.field);
    }

    if (options.limit && options.limit > 0 && options.type === FilterFieldType.FieldValue) {
      urlParams.append('limit', options.limit.toString());
    }

    const params = Object.fromEntries(urlParams);

    const url =
      options.type === FilterFieldType.FieldName
        ? 'select/logsql/stream_field_names'
        : 'select/logsql/stream_field_values';
    const key = `${url}?${urlParams.toString()}`;

    const cached = this.cacheValues.get(key);
    if (cached) {
      return cached;
    }

    const res = (await this.datasource.postResource(url, params)) as FieldHitsResponse;
    const result = (res?.values || []) as FieldHits[];
    const sortedResult = sortByHits(result, 'desc');
    this.cacheValues.set(key, sortedResult);
    return sortedResult;
  }

  getTimeRangeParams(timeRange?: TimeRange) {
    const range = timeRange ?? getDefaultTimeRange();

    return {
      start: range.from.valueOf(),
      end: range.to.valueOf(),
    };
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
  const types = new Set(data.map((item) => determineType(item.value)));
  return types.size === 1 ? Array.from(types)[0] : HitsValueType.STRING;
}

function sortFieldHits(data: FieldHits[]): FieldHits[] {
  const filteredData = data.filter((item) => item.value !== '');
  const arrayType = getArrayType(filteredData);

  return filteredData.sort((a, b) => {
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

function sortByHits(data: FieldHits[], direction: 'asc' | 'desc' = 'desc'): FieldHits[] {
  const order = direction === 'asc' ? 1 : -1;
  return data.filter((item) => item.value !== '').sort((a, b) => (a.hits - b.hits) * order);
}
