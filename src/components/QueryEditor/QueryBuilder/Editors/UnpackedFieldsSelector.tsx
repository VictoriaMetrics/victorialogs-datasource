import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { MultiSelect } from '@grafana/ui';

import { FilterFieldType, VisualQuery } from "../../../../types";
import { getValuesFromBrackets } from '../utils/operationParser';
import { quoteString } from '../utils/stringHandler';
import { splitString } from '../utils/stringSplitter';

export default function UnpackedFieldsSelector(unpackOperation: "unpack_json" | "unpack_logfmt" | "unpack_syslog") {
  function UnpackedFieldsSelectorEditor(props: QueryBuilderOperationParamEditorProps) {
    const { value, onChange, index, datasource, timeRange, query, operation, queryModeller } = props;

    const str = splitString(String(value || ""));
    const [values, setValues] = useState<SelectableValue<string>[]>(toOption(getValuesFromBrackets(str)));

    const setFields = (values: SelectableValue<string>[]) => {
      setValues(values);
      const newValue = values
        .map(({ value = "" }) => value)
        .filter(Boolean)
        .map(quoteString)
        .join(", ");
      if (values.length === 0) {
        onChange(index, "");
      } else {
        onChange(index, newValue);
      }
    }

    const [state, setState] = useState<{
      options?: SelectableValue[];
      isLoading?: boolean;
    }>({});

    return (
      <MultiSelect<string>
        openMenuOnFocus
        onOpenMenu={async () => {
          setState({ isLoading: true });
          const fieldName = operation.params[0] as string;
          const operations = (query as VisualQuery).operations;
          const operationIdx = operations.findIndex(op => op === operation);
          const prevOperations = operations.slice(0, operationIdx);
          let prevExpr = queryModeller.renderQuery({ operations: prevOperations, labels: [] });
          const unpackedQuery = ` | fields "${fieldName}" | ${unpackOperation} from "${fieldName}" result_prefix "result_" | delete "${fieldName}" `;
          if (prevExpr === "") {
            prevExpr = "*";
          }
          const queryExpr = prevExpr + unpackedQuery;
          let options = await datasource.languageProvider?.getFieldList({ query: queryExpr, timeRange, type: FilterFieldType.FieldName });
          options = options ? options.map(({ value, hits }: { value: string; hits: number }) => ({
            value: value.replace(/^(result_)/, ""),
            label: value.replace(/^(result_)/, "") || " ",
            description: `hits: ${hits}`,
          })) : []
          setState({ options, isLoading: undefined });
        }}
        isLoading={state.isLoading}
        allowCustomValue
        noOptionsMessage="No labels found"
        loadingMessage="Loading labels"
        options={state.options}
        value={values}
        onChange={setFields}
      />
    );
  }
  return UnpackedFieldsSelectorEditor;
}

const toOption = (
  values: string[]
): SelectableValue<string>[] => {
  values = values.filter(Boolean);
  return values.map((value) => {
    return { label: value?.toString(), value };
  })
}
