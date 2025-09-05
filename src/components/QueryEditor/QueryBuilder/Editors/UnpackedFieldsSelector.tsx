import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { ActionMeta, MultiSelect } from '@grafana/ui';

import { FilterFieldType, VisualQuery } from "../../../../types";
import { getValuesFromBrackets } from '../utils/operationParser';
import { quoteString } from '../utils/stringHandler';
import { splitString } from '../utils/stringSplitter';

export default function UnpackedFieldsSelector(unpackOperation: "unpack_json" | "unpack_logfmt" | "unpack_syslog") {
  function UnpackedFieldsSelectorEditor(props: QueryBuilderOperationParamEditorProps) {
    const { value, onChange, index, datasource, timeRange, query, operation, queryModeller } = props;

    const str = splitString(String(value || ""));
    const [values, setValues] = useState<SelectableValue<string>[]>(toOption(getValuesFromBrackets(str)));

    const setFields = (newValues: SelectableValue<string>[], action: ActionMeta) => {
      if (action) {
        if (action.action === "remove-value") {
          newValues = values.filter((v) => v.value !== (action.removedValue as SelectableValue<string>).value);
        }
      }
      setValues(newValues);
      const newValue = newValues
        .map(({ value = "" }) => value)
        .filter(Boolean)
        .map(quoteString)
        .join(", ");
      if (newValues.length === 0) {
        onChange(index, "");
      } else {
        onChange(index, newValue);
      }
    }

    const [isLoading, setIsLoading] = useState(false);
    const [options, setOptions] = useState<SelectableValue<string>[]>([]);

    const handleOpenMenu = async () => {
      setIsLoading(true);
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
      setOptions(options);
      setIsLoading(false);
    }

    return (
      <MultiSelect<string>
        openMenuOnFocus
        onOpenMenu={handleOpenMenu}
        isLoading={isLoading}
        allowCustomValue
        allowCreateWhileLoading
        noOptionsMessage="No labels found"
        loadingMessage="Loading labels"
        options={options}
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
