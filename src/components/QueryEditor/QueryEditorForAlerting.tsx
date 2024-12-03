import React from 'react';

import { VictoriaLogsQueryEditorProps } from "../../types";

import QueryField from "./QueryField";

const QueryEditorForAlerting = (props: VictoriaLogsQueryEditorProps) => {
  const { query, data, datasource, onChange, onRunQuery, history } = props;

  return (
    <QueryField
      datasource={datasource}
      query={query}
      onChange={onChange}
      onRunQuery={onRunQuery}
      history={history}
      data={data}
      data-testid={testIds.editor}
    />
  );
}

export default QueryEditorForAlerting

export const testIds = {
  editor: 'victorialogs-editor-cloud-alerting',
};
