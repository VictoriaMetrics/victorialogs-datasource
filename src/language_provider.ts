import { getDefaultTimeRange, LanguageProvider, TimeRange, } from '@grafana/data';

import { VictoriaLogsDatasource } from './datasource';
import { FieldHits, FieldHitsResponse, FilterFieldType } from './types';

interface FetchFieldsOptions {
  type: FilterFieldType;
  query?: string;
  field?: string;
  timeRange?: TimeRange;
  limit?: number;
}

enum HitsValueType {
  NUMBER = 'number',
  DATE = 'date',
  STRING = 'string'
}

export default class LogsQlLanguageProvider extends LanguageProvider {
  request!: (url: string, params?: any) => Promise<any>;
  declare startTask: Promise<any>;
  datasource: VictoriaLogsDatasource;
  cacheSize: number;
  cacheValues: Map<string, FieldHits[]>;

  constructor(datasource: VictoriaLogsDatasource, initialValues?: Partial<LogsQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.cacheSize = 100;
    this.cacheValues = new Map<string, FieldHits[]>();

    Object.assign(this, initialValues);
  }

  start = async (): Promise<any[]> => {
    return Promise.all([]);
  };

  async getFieldList(options: FetchFieldsOptions): Promise<FieldHits[]> {
    if (options.type === FilterFieldType.FieldValue && !options.field) {
      console.warn('getFieldList: field is required for FieldValue type');
      return [];
    }
    if (options.type === FilterFieldType.StreamFieldValues && !options.field) {
      console.warn('getFieldList: field is required for StreamFieldValues type');
      return [];
    }

    const urlParams = new URLSearchParams();
    urlParams.append('query', options.query || '*');

    const timeRange = this.getTimeRangeParams(options.timeRange);
    urlParams.append('start', timeRange.start.toString());
    urlParams.append('end', timeRange.end.toString());

    if ((options.type === FilterFieldType.FieldValue || options.type === FilterFieldType.StreamFieldValues) && options.field) {
      urlParams.append('field', options.field);
    }

    if (options.limit && options.limit > 0 && options.type === FilterFieldType.FieldValue) {
      urlParams.append('limit', options.limit.toString());
    }

    const params = Object.fromEntries(urlParams);

    let url = "";
    switch (options.type) {
      case FilterFieldType.FieldName:
        url = 'select/logsql/field_names';
        break;
      case FilterFieldType.FieldValue:
        url = `select/logsql/field_values`;
        break;
      case FilterFieldType.StreamFieldNames:
        url = 'select/logsql/stream_field_names';
        break;
      case FilterFieldType.StreamFieldValues:
        url = `select/logsql/stream_field_values`;
        break;
      default:
        throw new Error(`Unsupported field type: ${options.type}`);
    }
    const key = `${url}?${urlParams.toString()}`;

    if (this.cacheValues.has(key)) {
      return this.cacheValues.get(key)!;
    }

    if (this.cacheValues.size >= this.cacheSize) {
      const firstKey = this.cacheValues.keys().next().value;
      this.cacheValues.delete(firstKey);
    }

    try {
      const res = (await this.datasource.postResource(url, params)) as FieldHitsResponse;
      const result = (res?.values || []) as FieldHits[];
      const sortedResult = sortFieldHits(result);
      this.cacheValues.set(key, sortedResult);
      return sortedResult;
    } catch (error) {
      throw error;
    }
  }

  getTimeRangeParams(timeRange?: TimeRange) {
    const range = timeRange ?? getDefaultTimeRange();

    const start = new Date(range.from.valueOf());
    start.setHours(0, 0, 0, 0); // set start of day

    const end = new Date(range.to.valueOf());
    end.setHours(23, 59, 59, 999); // set end of day

    return {
      start: start.valueOf(),
      end: end.valueOf(),
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
  const types = new Set(data.map(item => determineType(item.value)));
  return types.size === 1 ? Array.from(types)[0] : HitsValueType.STRING;
}

function sortFieldHits(data: FieldHits[]): FieldHits[] {
  const filteredData = data.filter(item => item.value !== "");
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
