import React from 'react';

import { QueryEditorProps } from '@grafana/data';

import { VictoriaLogsDatasource } from "../../datasource";
import { Options, Query } from "../../types";
import { MonacoQueryFieldWrapper } from "../monaco-query-field/MonacoQueryFieldWrapper";

export interface QueryFieldProps extends QueryEditorProps<VictoriaLogsDatasource, Query, Options> {
  ExtraFieldElement?: React.ReactNode;
  'data-testid'?: string;
}

const QueryField: React.FC<QueryFieldProps> = (
  {
    ExtraFieldElement,
    query,
    history,
    onRunQuery,
    onChange,
    'data-testid': dataTestId
  }) => {

  const onChangeQuery = (value: string) => {
    onChange && onChange({ ...query, expr: value });
  };

  return (
    <>
      <div
        className="gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1"
        data-testid={dataTestId}
      >
        <div className="gf-form--grow flex-shrink-1 min-width-15">
          <MonacoQueryFieldWrapper
            runQueryOnBlur={false}
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
