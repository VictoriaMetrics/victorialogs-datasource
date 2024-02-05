import { Observable } from "rxjs";

import { DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import QueryEditor from "./components/QueryEditor/QueryEditor";
import { Query, Options } from './types';

export class VictoriaLogsDatasource
  extends DataSourceWithBackend<Query, Options> {
  maxLines: number;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<Options>,
    // private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);

    // this.languageProvider = new LanguageProvider(this);
    const settingsData = instanceSettings.jsonData || {};
    this.maxLines = parseInt(settingsData.maxLines ?? '0', 10) || 10;
    this.annotations = {
      QueryEditor: QueryEditor,
    };
    // this.variables = new LokiVariableSupport(this);
    // this.logContextProvider = new LogContextProvider(this);
  }

  query(options: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    console.log('query')
    const promises = options.targets.map(target => {
      const query = target.expr; // Получение запроса из объекта target
      const server = this.instanceSettings.url; // URL сервера из настроек источника данных
      const url = `${server}/select/logsql/query`
      const params = new URLSearchParams({
        query: encodeURIComponent(query.trim())
      })
      const options = {
        method: 'GET',
        headers: {
          "Accept": "application/stream+json; charset=utf-8",
          "Content-Type": "application/x-www-form-urlencoded",
        }
      }

      return fetch(`${url}?${params}`, options)
        .then(response => response.text())
        .then(text => {
          console.log(text)
          const data = text.split('\n')
            .map(line => {
              try {
                return JSON.parse(line);
              } catch (e) {
                return null;
              }
            })
            .filter(line => line)
            .slice(-this.maxLines); // Ограничение количества строк

          return { data };
        })
        .catch(error => {
          console.error('Error fetching logs:', error);
          throw new Error(`Error fetching logs: ${error.message}`);
        });
    });

    return new Observable<DataQueryResponse>(subscriber => {
      Promise.all(promises).then(data => {
        subscriber.next({ data });
        subscriber.complete();
      }).catch(error => {
        subscriber.error(error);
      });
    });
  }
}
