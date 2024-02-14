import React from 'react';

import { QueryEditorProps } from '@grafana/data';

import { VictoriaLogsDatasource } from "../../datasource";
import { Options, Query } from "../../types";
import { MonacoQueryFieldWrapper } from "../monaco-query-field/MonacoQueryFieldWrapper";

export interface QueryFieldProps extends QueryEditorProps<VictoriaLogsDatasource, Query, Options> {
  ExtraFieldElement?: React.ReactNode;
  'data-testid'?: string;
}

const QueryField: React.FC<QueryFieldProps> = (props) => {
  const {
    ExtraFieldElement,
    query,
    // datasource,
    history,
    onRunQuery,
    // range,
    onChange,
    'data-testid': dataTestId
  } = props;
  // const [labelsLoaded, setLabelsLoaded] = useState(false);

  // Replace componentDidUpdate logic if needed

  const onChangeQuery = (value: string) => {
    if (onChange) {
      const nextQuery = { ...query, expr: value };
      onChange(nextQuery);

      // if (override && onRunQuery) {
      //   onRunQuery();
      // }
    }
  };

  return (
    <>
      <div
        className="gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1"
        data-testid={dataTestId}
      >
        <div className="gf-form--grow flex-shrink-1 min-width-15">
          <MonacoQueryFieldWrapper
            runQueryOnBlur
            history={history ?? []}
            onChange={onChangeQuery}
            onRunQuery={onRunQuery}
            initialValue={query.expr ?? ''}
            placeholder="Enter a LogsQL query…"
          />
        </div>
      </div>
      {ExtraFieldElement}
    </>
  );
};

export default QueryField;
