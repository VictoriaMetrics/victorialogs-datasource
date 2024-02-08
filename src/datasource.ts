import { Observable } from "rxjs";
import { map } from 'rxjs/operators';

import { DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { transformBackendResult } from "./backendResultTransformer";
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

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const queries = request.targets
      .map((q) => ({ ...q, maxLines: q.maxLines ?? this.maxLines }));

    const fixedRequest: DataQueryRequest<Query> = {
      ...request,
      targets: queries,
    };

    return this.runQuery(fixedRequest);
  }

  runQuery(fixedRequest: DataQueryRequest<Query>) {
    return super
      .query(fixedRequest)
      .pipe(
        map((response) =>
          transformBackendResult(response, fixedRequest.targets, [])
        )
      );
  }
}
