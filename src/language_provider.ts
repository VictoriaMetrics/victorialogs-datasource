import {
  getDefaultTimeRange,
  LanguageProvider,
  TimeRange,
} from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { VictoriaLogsDatasource } from './datasource';

export default class LogsQlLanguageProvider extends LanguageProvider {
  declare startTask: Promise<any>;
  datasource: VictoriaLogsDatasource;
  timeRange: TimeRange;
  fieldNames: string[];
  fieldValues: string[] = [];

  constructor(datasource: VictoriaLogsDatasource, initialValues?: Partial<LogsQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.timeRange = getDefaultTimeRange();
    this.fieldNames = [];
    this.fieldValues = [];

    Object.assign(this, initialValues);
  }

  request = async (url: string, defaultValue: any, params = {}, options?: Partial<BackendSrvRequest>): Promise<any> => {
    console.log('request', url)
    try {
      const res = await this.datasource.metadataRequest(url, params, options);
      return res.data.data;
    } catch (error) {
      console.error(error);
    }

    return defaultValue;
  };

  start = async (timeRange?: TimeRange): Promise<any[]> => {
    this.timeRange = timeRange ?? getDefaultTimeRange();
    return Promise.all([]);
  };

  async fetchFieldNames(): Promise<string[]> {
    const url = 'select/logsql/field_names';
    const params = {} // this.datasource.getTimeRangeParams();
    const query = "*" // this.datasource.getLimitMetrics('maxTagKeys');
    return await this.request(url, [], { ...params, query }, { method: 'POST' });
  }

  async getFieldNames(): Promise<string[]> {
    return await this.fetchFieldNames();
  }

  fetchFieldValues = async (): Promise<string[]> => {
    const url = `select/logsql/values`;
    const params = {} // this.datasource.getTimeRangeParams();
    const query = "*" // this.datasource.getLimitMetrics('maxTagValues');
    return await this.request(url, [], { ...params, query }, { method: 'POST' });
  };

  async getFieldValues(): Promise<string[]> {
    return await this.fetchFieldValues();
  }
}

