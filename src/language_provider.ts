import { getDefaultTimeRange, LanguageProvider, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from './datasource';
import { FieldHits, FieldHitsResponse, FilterFieldType } from './types';

interface FetchFieldsOptions {
  type: FilterFieldType;
  query?: string;
  field?: string;
  timeRange?: TimeRange;
  limit?: number;
  /** Filter for field values using containing match (server-side filtering) */
  fieldValueFilter?: string;
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

    // Build query with optional field value filter (prefix match for server-side filtering)
    let finalQuery = options.query || '*';
    if (options.type === FilterFieldType.FieldValue && options.field && options.fieldValueFilter) {
      const fieldFilter = `${options.field}: i("${options.fieldValueFilter}")`;
      finalQuery = finalQuery === '*' ? fieldFilter : `(${finalQuery}) AND ${fieldFilter}`;
    }
    urlParams.append('query', finalQuery);

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

    if (this.cacheValues.has(key)) {
      return this.cacheValues.get(key)!;
    }

    if (this.cacheValues.size >= this.cacheSize) {
      const firstKey = this.cacheValues.keys().next().value;
      if (firstKey) {
        this.cacheValues.delete(firstKey);
      }
    }

    const res = (await this.datasource.postResource(url, params)) as FieldHitsResponse;
    const result = (res?.values || []) as FieldHits[];
    const sortedResult = sortFieldHits(result);
    this.cacheValues.set(key, sortedResult);
    return sortedResult;
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
  const types = new Set(data.map((item) => determineType(item.value)));
  return types.size === 1 ? Array.from(types)[0] : HitsValueType.STRING;
}

function sortFieldHits(data: FieldHits[]): FieldHits[] {
  const filteredData = data.filter(item => item.value !== '');
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
