import { DataSourcePlugin } from '@grafana/data';

import QueryEditorByApp from './components/QueryEditor/QueryEditorByApp';
import ConfigEditor from './configuration/ConfigEditor';
import { VictoriaLogsDatasource } from './datasource';

export const plugin = new DataSourcePlugin(VictoriaLogsDatasource)
  .setQueryEditor(QueryEditorByApp)
  .setConfigEditor(ConfigEditor);
