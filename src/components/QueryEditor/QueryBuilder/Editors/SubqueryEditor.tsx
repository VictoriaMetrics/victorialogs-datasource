import React, { useMemo, useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { OperationList, QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { RadioButtonGroup, MultiSelect, Select } from '@grafana/ui';

import { VisualQuery } from '../../../../types';
import { VictoriaLogsOperationId } from '../Operations';
import { buildVisualQueryToString, parseExprToVisualQuery } from "../QueryModeller";
import { getValue, isValue, quoteString, unquoteString } from '../utils/stringHandler';
import { SplitString, splitString } from '../utils/stringSplitter';

import { getFieldNameOptions, getFieldValueOptions } from './utils/editorHelper';

export const checkLegacyMultiExact = (str: SplitString[]): boolean => {
  // (="error" OR ="fatal")
  if (str.length < 2) {
    return false;
  }
  while (str.length >= 2) {
    if (!(str[0].type === "space" && str[0].value === "=")) {
      return false;
    }
    if (str[1].type === "bracket") {
      return false;
    }
    str = str.slice(2);
    if (str.length > 0) {
      if (str[0].type === "space" && str[0].value.toLowerCase() === "or") {
        str = str.slice(1);
      } else {
        return false;
      }
    }
  }
  return true;
}

function parseLegacyMultiExact(str: SplitString[]): string[] {
  let values: string[] = [];
  while (str.length >= 2) {
    if (!(str[0].type === "space" && str[0].value === "=")) {
      break;
    }
    if (str[1].type === "bracket") {
      break;
    }
    if (isValue(str[1])) {
      values.push(getValue(str[1]));
    }
    str = str.slice(2);
    if (str.length > 0) {
      if (str[0].type === "space" && str[0].value.toLowerCase() === "or") {
        str = str.slice(1);
      } else {
        break;
      }
    }
  }
  return values;
}

function parseSubquery(value: string): { values: string[]; isQuery: boolean; query: string; fieldName: string } {
  let str = splitString(value);
  if (str.length === 0) { // empty === stream_id
    return { values: [], isQuery: false, query: "", fieldName: "" };
  } else if (str[0].type !== "bracket") { // stream_id
    let value = str[0].value;
    return { values: [unquoteString(value)], isQuery: false, query: "", fieldName: "" };
  } else if (checkLegacyMultiExact(str[0].value)) { // legacy multi exact
    const values = parseLegacyMultiExact(str[0].value);
    return { values, isQuery: false, query: "", fieldName: "" };
  }
  const query = str[0].raw_value.slice(1, -1);
  if (query === "") {
    return { values: [], isQuery: false, query: "", fieldName: "" };
  }
  const visQuery = parseExprToVisualQuery(query);
  const lastOp = visQuery.query.operations[visQuery.query.operations.length - 1];
  const isQuery = lastOp ? [VictoriaLogsOperationId.Fields, VictoriaLogsOperationId.Uniq].includes(lastOp.id as VictoriaLogsOperationId) : false;
  if (isQuery) {
    const lastOp = visQuery.query.operations[visQuery.query.operations.length - 1];
    const fieldName = unquoteString(lastOp.params[0] as string);
    visQuery.query.operations.pop();
    return { values: [], isQuery: true, query: buildVisualQueryToString(visQuery.query), fieldName };
  } else {
    let values: string[] = [];
    const str = splitString(query);
    for (const value of str) {
      if (value.type === "space" && value.value === ",") {
        continue;
      }
      if (isValue(value)) {
        values.push(getValue(value));
      }
    }
    return { values, isQuery: false, query: "", fieldName: "" };
  }
}

export default function SubqueryEditor(props: QueryBuilderOperationParamEditorProps) {
  const { datasource, timeRange, onRunQuery, onChange, index, value, operation, queryModeller } = props;
  const paramLen = operation.params.length;
  // paramLen = 1 -> StreamId (single value possible)
  // paramLen = 2 -> Multi Exact, contains_all, contains_any
  const isStreamIdFilter = paramLen === 1;
  let stdFieldName = "";
  if (isStreamIdFilter) {
    stdFieldName = "_stream_id";
  } else {
    stdFieldName = operation.params[0] as string;
  }
  const parsedSubquery = useMemo(() => parseSubquery(String(value || "")), [value]);
  const { values, isQuery, query: queryValue, fieldName } = parsedSubquery;

  const [filterValues, setFilterValues] = useState<string[]>(values);
  const [useQueryAsValue, setUseQueryAsValue] = useState<boolean>(isQuery);
  const [selectQuery, setSelectQuery] = useState<{ expr: string, visQuery: VisualQuery }>({
    expr: queryValue,
    visQuery: parseExprToVisualQuery(queryValue).query
  })
  const [queryField, setQueryField] = useState<string>(fieldName);

  const buildSubqueryValue = (values: SelectableValue[]) => {
    const strValues = values.filter(v => v.value !== undefined && v.value !== "").map(v => v.value);
    setFilterValues(strValues);
    const valueExpr = "(" + strValues.map(value => {
      if (value.startsWith("$")) {
        return value;
      }
      return quoteString(value);
    }).join(", ") + ")";
    if (isStreamIdFilter) {
      if (strValues.length === 1) {
        onChange(index, strValues[0]);
        return;
      } else {
        onChange(index, "in" + valueExpr);
        return;
      }
    }
    onChange(index, valueExpr);
  }

  const buildSubquery = (query: string, fieldName: string, stdFieldName: string) => {
    fieldName = fieldName.trim();
    if (fieldName === "") {
      fieldName = stdFieldName;
    }
    let queryExpr = "in( ";
    if (query !== "") {
      queryExpr += query + " | ";
    }
    queryExpr += `fields ${quoteString(fieldName)})`;
    onChange(index, queryExpr);
  }

  const onEditorChange = (query: VisualQuery) => {
    const expr = buildVisualQueryToString(query);
    buildSubquery(expr, queryField, stdFieldName);
    setSelectQuery({ expr, visQuery: query })
  };
  const [fieldNames, setFieldNames] = useState<SelectableValue<string>[]>([])
  const [isLoadingFieldNames, setIsLoadingFieldNames] = useState(false);
  const handleOpenMenu = async () => {
    setIsLoadingFieldNames(true);
    const options = await getFieldValueOptions(props, stdFieldName);
    setFieldNames(options)
    setIsLoadingFieldNames(false)
  }
  const [state, setState] = useState({
    loading: false,
    options: [] as any[],
  });
  return (
    <>
      <div style={{ padding: '6px 0 8px 0px', display: 'block' }}>
        <div style={{ width: '100%', marginBottom: '8px' }}>
          <RadioButtonGroup
            options={[
              { label: 'values', value: false },
              { label: 'query', value: true },
            ]}
            value={useQueryAsValue}
            onChange={(value) => {
              setUseQueryAsValue(value);
              if (value) {
                buildSubquery("", queryField, stdFieldName)
              } else {
                buildSubqueryValue([]);
              }
            }}
            size="sm"
          />
        </div>
        {!useQueryAsValue &&
          <MultiSelect<string>
            onChange={buildSubqueryValue}
            options={fieldNames}
            value={filterValues}
            isLoading={isLoadingFieldNames}
            allowCustomValue
            noOptionsMessage="No labels found"
            loadingMessage="Loading labels"
            width={30}
            onOpenMenu={handleOpenMenu}
          />
        }
        {useQueryAsValue &&
          <>
            <OperationList
              query={selectQuery.visQuery}
              datasource={datasource}
              onChange={onEditorChange}
              timeRange={timeRange}
              onRunQuery={onRunQuery}
              queryModeller={queryModeller}
            />
            FieldName

            <Select<string>
              allowCustomValue={true}
              allowCreateWhileLoading={true}
              isLoading={state.loading}
              onOpenMenu={async () => {
                setState((prev) => ({ ...prev, loading: true }));
                setState({
                  loading: false,
                  options: await getFieldNameOptions(props),
                });
              }}
              options={state.options}
              onChange={({ value = "" }) => {
                setQueryField(value);
                buildSubquery(selectQuery.expr, value, stdFieldName);
              }}
              value={toOption(queryField)}
              width="auto"
            />
          </>
        }
      </div>
    </>
  );
}
