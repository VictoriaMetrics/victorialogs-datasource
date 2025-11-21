import { getDefaultTimeRange, LanguageProvider, TimeRange, } from '@grafana/data';

import { VictoriaLogsDatasource } from './datasource';
import { extractLogParserFromSample } from './languageUtils';
import { FieldHits, FieldHitsResponse, FilterFieldType, ParserAndLabelKeysResult } from './types';

interface FetchFieldsOptions {
  type: FilterFieldType;
  query?: string;
  field?: string;
  timeRange?: TimeRange;
  limit?: number;
}

interface LogQueryOptions {
  timeRange?: TimeRange;
  query?: string;
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

    const url = options.type === FilterFieldType.FieldName ? 'select/logsql/field_names' : `select/logsql/field_values`;
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

  async query(options: LogQueryOptions): Promise<Record<string, unknown>[]> {
    const url = 'select/logsql/query';
    const timeRange = this.getTimeRangeParams(options.timeRange);
    const params = new URLSearchParams({
      query: options.query ?? '*',
      start: timeRange.start.toString(),
      end: timeRange.end.toString(),
      limit: (options.limit ?? 10).toString(),
    });
    try {
      const res = (await this.datasource.postResource<string>(url, params, { responseType: 'text' }));
      const lines = res.split('\n').filter(line => line.trim() !== '');
      return lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return { message: line };
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get parser and label keys for a selector
   *
   * This asynchronous function is used to fetch parsers and label keys for a selected log stream based on sampled lines.
   * It returns a promise that resolves to an object with the following properties:
   *
   * - `extractedLabelKeys`: An array of available label keys associated with the log stream.
   * - `hasJSON`: A boolean indicating whether JSON parsing is available for the stream.
   * - `hasLogfmt`: A boolean indicating whether Logfmt parsing is available for the stream.
   * - `hasPack`: A boolean indicating whether Pack parsing is available for the stream.
   * - `unwrapLabelKeys`: An array of label keys that can be used for unwrapping log data.
   *
   * @param streamSelector - The selector for the log stream you want to analyze.
   * @param options - (Optional) An object containing additional options.
   * @param options.maxLines - (Optional) The number of log lines requested when determining parsers and label keys.
   * @param options.timeRange - (Optional) The time range for which you want to retrieve label keys. If not provided, the default time range is used.
   * Smaller maxLines is recommended for improved query performance. The default count is 10.
   * @returns A promise containing an object with parser and label key information.
   * @throws An error if the fetch operation fails.
   */
  async getParserAndLabelKeys(
    streamSelector: string,
    options?: { maxLines?: number; timeRange?: TimeRange }
  ): Promise<ParserAndLabelKeysResult> {
    const empty = {
      extractedLabelKeys: [],
      structuredMetadataKeys: [],
      unwrapLabelKeys: [],
      hasJSON: false,
      hasLogfmt: false,
    };

    const sample = await this.query({
      query: streamSelector,
      limit: options?.maxLines || 10,
      timeRange: options?.timeRange,
    });

    if (!sample.length) {
      return empty;
    }

    const { hasLogfmt, hasJSON } = extractLogParserFromSample(sample);

    return {
      extractedLabelKeys: [],
      structuredMetadataKeys: [],
      unwrapLabelKeys: [],
      hasJSON,
      hasLogfmt,
    };
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
