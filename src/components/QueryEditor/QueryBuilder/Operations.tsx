import React, { FunctionComponent, useMemo, useState } from 'react';

import { DataSourceApi } from '@grafana/data';
import { QueryBuilderOperationDefinition, VisualQueryModeller, QueryBuilderOperationParamEditorProps, QueryBuilderOperationParamValue, QueryBuilderOperation, OperationList } from '@grafana/plugin-ui';

import { VisualQuery } from "../../../types";

import ExactValueEditor from './Editors/ExactValueEditor';
import FieldAsFieldEditor from './Editors/FieldAsFieldEditor';
import FieldEditor from './Editors/FieldEditor';
import FieldValueTypeEditor from './Editors/FieldValueTypeEditor';
import FieldsEditor from './Editors/FieldsEditor';
import FieldsEditorWithPrefix from './Editors/FieldsEditorWithPrefix';
import LogicalFilterEditor from './Editors/LogicalFilterEditor';
import MathExprEditor from './Editors/MathExprEditor';
import NumberEditor from './Editors/NumberEditor';
import QueryEditor from './Editors/QueryEditor';
import ResultFieldEditor from './Editors/ResultFieldEditor';
import SingleCharInput from './Editors/SingleCharInput';
import SortedFieldsEditor from './Editors/SortedFieldsEditor';
import StatsEditor from './Editors/StatsEditor';
import StreamFieldEditor from './Editors/StreamFieldEditor';
import SubqueryEditor from './Editors/SubqueryEditor';
import UnpackedFieldsSelector from './Editors/UnpackedFieldsSelector';
import VariableEditor from './Editors/VariableEditor';
import { parseExprToVisualQuery } from './QueryModeller';
import { QueryModeller } from "./QueryModellerClass";
import { VictoriaLogsQueryOperationCategory } from "./VictoriaLogsQueryOperationCategory";
import { getValuesFromBrackets, getConditionFromString } from './utils/operationParser';
import { getValue, isValue, quoteString, unquoteString } from './utils/stringHandler';
import { buildSplitString, splitByUnescapedChar, SplitString } from './utils/stringSplitter';

export enum VictoriaLogsOperationId {
  Word = 'word',
  Time = 'time',
  DayRange = 'day_range',
  WeekRange = 'week_range',
  Stream = 'stream',
  StreamId = 'stream_id',
  RangeComparison = 'range_comparison',
  Exact = 'exact',
  MultiExact = 'multi_exact',
  ContainsAll = 'contains_all',
  ContainsAny = 'contains_any',
  Sequence = 'seq',
  Regexp = 'regexp',
  Range = 'range',
  IPv4Range = 'ipv4_range',
  StringRange = 'string_range',
  LengthRange = 'len_range',
  ValueType = 'value_type',
  EqField = 'eq_field',
  LeField = 'le_field',
  LtField = 'lt_field',
  Logical = 'logical',
  // Operators
  AND = 'and',
  OR = 'or',
  NOT = 'not',
  // Pipes
  BlockStats = 'block_stats',
  BlocksCount = 'blocks_count',
  CollapseNums = 'collapse_nums',
  Copy = 'copy',
  Decolorize = 'decolorize',
  Delete = 'delete',
  DropEmptyFields = 'drop_empty_fields',
  Extract = 'extract',
  ExtractRegexp = 'extract_regexp',
  Facets = 'facets',
  FieldNmes = 'field_names',
  FieldValues = 'field_values',
  Fields = 'fields',
  First = 'first',
  Format = 'format',
  Join = 'join',
  JsonArrayLen = 'json_array_len',
  Hash = 'hash',
  Last = 'last',
  Len = 'len',
  Limit = 'limit',
  Math = 'math',
  Offset = 'offset',
  PackJSON = 'pack_json',
  PackLogfmt = 'pack_logfmt',
  Rename = 'rename',
  Replace = 'replace',
  ReplaceRegexp = 'replace_regexp',
  Sample = 'sample',
  Sort = 'sort',
  Stats = 'stats',
  StreamContext = 'stream_context',
  TimeAdd = 'time_add',
  Top = 'top',
  Union = 'union',
  Uniq = 'uniq',
  UnpackJson = 'unpack_json',
  UnpackLogfmt = 'unpack_logfmt',
  UnpackSyslog = 'unpack_syslog',
  UnpackWords = 'unpack_words',
  Unroll = 'unroll',
  // Stats
  Avg = 'avg',
  Count = 'count',
  CountEmpty = 'count_empty',
  CountUniq = 'count_uniq',
  CountUniqHash = 'count_uniq_hash',
  Histogram = 'histogram',
  JsonValues = 'json_values',
  Max = 'max',
  Median = 'median',
  Min = 'min',
  Quantile = 'quantile',
  Rate = 'rate',
  RateSum = 'rate_sum',
  RowAny = 'row_any',
  RowMax = 'row_max',
  RowMin = 'row_min',
  Sum = 'sum',
  SumLen = 'sum_len',
  UniqValues = 'uniq_values',
  Values = 'values',
  // Special
  Options = 'options',
  FieldContainsAnyValueFromVariable = 'contains_any_from_variable', // multi variable not compatible with normal contains_any
  Comment = 'comment',
}

export interface VictoriaQueryBuilderOperationDefinition extends QueryBuilderOperationDefinition {
  /** returns an array of parameter values matching the exact types and order in defaultParams */
  splitStringByParams: (str: SplitString[], fieldName?: string) => { params: QueryBuilderOperationParamValue[], length: number };
}

function addVictoriaOperation(
  def: QueryBuilderOperationDefinition,
  query: VisualQuery,
  modeller: VisualQueryModeller
): VisualQuery {
  query.operations.push({
    id: def.id,
    params: def.defaultParams,
  });
  return query;
}

function parseFieldMapList(str: SplitString[]): { params: QueryBuilderOperationParamValue[], length: number } {
  let length = str.length;
  let params: string[] = [];
  let fromField = ""
  let toField = "";
  while (str.length > 0) {
    if (str[0].value === ",") {
      params.push("");
      str.shift();
      if (str.length === 0) {
        params.push("");
      }
      continue;
    }
    if (!isValue(str[0])) {
      break;
    }
    fromField = getValue(str[0]);
    str.shift();
    if (str.length === 0 || !(str[0].type === "space" && str[0].value === "as")) {
      const quotedFromString = fromField === "" ? '""' : quoteString(fromField);
      params.push(`${quotedFromString} as ""`);
      break;
    }
    str = str.slice(1);
    if (str.length > 0 && isValue(str[0])) {
      toField = getValue(str[0]);
      str.shift();
    }
    const quotedFromString = fromField === "" ? '""' : quoteString(fromField);
    const quotedToString = toField === "" ? '""' : quoteString(toField);
    toField = "";
    params.push(`${quotedFromString} as ${quotedToString}`);
  }
  if (params.length === 0) {
    params = [""];
  }
  return { params, length: length - str.length };
}

function pipeExpr(innerExpr: string, expr: string): string {
  return innerExpr === "" ? expr : innerExpr + " | " + expr;
}

export class OperationDefinitions {
  defaultField: string;
  operationDefinitions: VictoriaQueryBuilderOperationDefinition[];
  conditionalEditor: FunctionComponent<QueryBuilderOperationParamEditorProps>;
  constructor(defaultField = "_msg") {
    this.defaultField = defaultField;
    this.conditionalEditor = this.getConditionalEditor();
    this.operationDefinitions = this.getOperationDefinitions();
  }

  all(): VictoriaQueryBuilderOperationDefinition[] {
    return this.operationDefinitions;
  }

  getConditionalEditor() {
    let filterDefinitions = this.getFilterDefinitions();
    const queryModeller = new QueryModeller(filterDefinitions);

    function ConditionalEditor(props: QueryBuilderOperationParamEditorProps) {
      const { value, index, onChange, onRunQuery, datasource, timeRange } = props;
      const visQuery = useMemo(() => {
        return parseExprToVisualQuery(String(value || "")).query;
      }, [value]);
      const [state, setState] = useState<{ expr: string, visQuery: VisualQuery }>({
        expr: String(value || ""),
        visQuery: visQuery,
      })
      const onEditorChange = (query: VisualQuery) => {
        const expr = queryModeller.renderQuery(query as VisualQuery);
        setState({ expr, visQuery: query })
        onChange(index, expr);
      };
      return (
        <OperationList
          query={state.visQuery}
          datasource={datasource as DataSourceApi}
          onChange={onEditorChange}
          timeRange={timeRange}
          onRunQuery={onRunQuery}
          queryModeller={queryModeller}
        />
      );
    }
    return ConditionalEditor;
  }


  getPipeDefinitions(): VictoriaQueryBuilderOperationDefinition[] {
    return [
      {
        id: VictoriaLogsOperationId.BlockStats,
        name: 'Block stats',
        params: [],
        defaultParams: [],
        toggleable: true,
        alternativesKey: "debug",
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => pipeExpr(innerExpr, "block_stats"),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [], length: 0 };
        },
      },
      {
        id: VictoriaLogsOperationId.BlocksCount,
        name: 'Blocks count',
        params: [],
        defaultParams: [],
        toggleable: true,
        alternativesKey: "debug",
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => pipeExpr(innerExpr, "blocks_count"),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [], length: 0 };
        },
      },
      {
        id: VictoriaLogsOperationId.CollapseNums,
        name: 'Collapse nums',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Prettify",
          type: "boolean",
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "style",
        defaultParams: [this.defaultField, false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const prettify = model.params[1] as boolean;
          const condition = model.params[2] as string;
          let expr = "collapse_nums";
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          if (field !== this.defaultField) {
            expr += ` at ${quoteString(field)}`;
          }
          if (prettify) {
            expr += " prettify";
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: [field: string, prettify: boolean, condition: string] = [this.defaultField, false, ""];
          params[2] = getConditionFromString(str);
          if (str.length > 1) { // at _msg
            if (str[0].type === "space" && str[0].value === "at") {
              str = str.slice(1);
              if (isValue(str[0])) {
                params[0] = getValue(str[0]);
              }
              str.shift();
            }
          }
          if (str.length > 0) {
            if (str[0].type === "space" && str[0].value === "prettify") {
              params[1] = true;
              str.shift();
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Copy,
        name: 'Copy',
        params: [{
          name: "Fields",
          type: "string",
          restParam: true,
          editor: FieldAsFieldEditor,
        }],
        alternativesKey: "change",
        defaultParams: ['"" as ""'],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fields = model.params.filter((v) => Boolean(v) || v === "");
          const expr = "copy " + fields.join(', ');
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseFieldMapList,
      },
      {
        id: VictoriaLogsOperationId.Decolorize,
        name: 'Decolorize',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }],
        alternativesKey: "style",
        defaultParams: ["_msg"],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          let expr = "decolorize";
          if (field !== this.defaultField) {
            expr += ` ${quoteString(field)}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: [string] = ["_msg"];
          if (str.length > 0) {
            if (isValue(str[0])) {
              params[0] = getValue(str[0]);
              str.shift();
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Delete,
        name: 'Delete',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }],
        alternativesKey: "change",
        defaultParams: [""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fields = model.params[0] as string;
          const expr = "delete " + fields;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          const values = parsePrefixFieldList(str);
          return { params: [values.join(", ")], length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Fields,
        name: 'Fields',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }],
        alternativesKey: "reduce",
        defaultParams: [""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fields = model.params[0] as string;
          const expr = "fields " + fields;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          const length = str.length;
          const fields = parsePrefixFieldList(str);
          if (fields.length === 0) {
            fields.push("");
          }
          const param = fields.join(", ");
          return { params: [param], length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.DropEmptyFields,
        name: 'Drop empty fields',
        params: [],
        alternativesKey: "change",
        defaultParams: [],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          return pipeExpr(innerExpr, "drop_empty_fields");
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [], length: 0 };
        },
      },
      {
        id: VictoriaLogsOperationId.Extract,
        name: 'Extract',
        params: [{
          name: "From field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Pattern",
          type: "string",
        }, {
          name: "Keep original fields",
          type: "boolean",
          optional: true,
        }, {
          name: "Skip emptry results",
          type: "boolean",
          optional: true,
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "extract",
        defaultParams: [this.defaultField, "", false, false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        explainHandler: () => `
Pattern: \`text1<field1>text2<field2>...textN<fieldN>textN+1\`
<br>
Where text1, … textN+1 is arbitrary non-empty text, which matches as is to the input text. Anonymous placeholders are written as <_>.`,
        renderer: (model, def, innerExpr) => buildExtractOperation(model, innerExpr, this.defaultField),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => parseExtractOperation(str, this.defaultField),
      },
      {
        id: VictoriaLogsOperationId.ExtractRegexp,
        name: 'Extract regex',
        params: [{
          name: "From field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Pattern",
          type: "string",
        }, {
          name: "Keep original fields",
          type: "boolean",
        }, {
          name: "Skip empty results",
          type: "boolean",
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "extract",
        defaultParams: [this.defaultField, "", false, false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => buildExtractOperation(model, innerExpr, this.defaultField),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => parseExtractOperation(str, this.defaultField),
      },
      {
        id: VictoriaLogsOperationId.Facets,
        name: 'Facets',
        params: [{
          name: "Number of facets",
          type: "number",
          optional: true,
        }, {
          name: "Max Values per Field",
          type: "number",
          optional: true,
        }, {
          name: "Max Value Length",
          type: "number",
          optional: true,
        }, {
          name: "Keep const fields",
          type: "boolean",
          optional: true,
        }],
        alternativesKey: "facets",
        defaultParams: [0, 0, 0, false],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const [numFacets, maxValuesPerField, maxValueLen, keepConstFields] = model.params as [number, number, number, boolean];
          let expr = "facets ";
          if (numFacets > 0) {
            expr += numFacets;
          }
          if (maxValuesPerField > 0) {
            expr += " max_values_per_field " + maxValuesPerField;
          }
          if (maxValueLen > 0) {
            expr += " max_value_len " + maxValueLen;
          }
          if (keepConstFields) {
            expr += " keep_const_fields";
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: [number, number, number, boolean] = [0, 0, 0, false];
          if (str.length > 0) {
            const number = parseNumber(str[0], undefined);
            if (number !== undefined) {
              params[0] = number;
              str.shift();
            }
            for (let i = 0; i < 3; i++) {
              if (str.length > 0 && str[0].type === "space") { // next max_values_per_field/max_value_len/keep_const_fields
                if (str[0].value === "keep_const_fields") {
                  params[3] = true;
                  str.shift();
                } else if (str[0].value === "max_values_per_field") {
                  str = str.slice(1);
                  params[1] = parseNumber(str[0], 0);
                  str.shift();
                } else if (str[0].value === "max_value_len") {
                  str = str.slice(1);
                  params[2] = parseNumber(str[0], 50);
                  str.shift();
                }
              }
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.FieldNmes,
        name: 'Field names',
        params: [],
        alternativesKey: "reduce",
        defaultParams: [],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          return pipeExpr(innerExpr, "field_names");
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [], length: 0 };
        },
      },
      {
        id: VictoriaLogsOperationId.FieldValues,
        name: 'Field values',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Limit",
          type: "number",
          optional: true,
        }],
        alternativesKey: "reduce",
        defaultParams: [this.defaultField, 0],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const limit = model.params[1] as number;
          let expr = `field_values ${quoteString(field)}`;
          if (limit > 0) {
            expr += " limit " + limit;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: [string, number] = [this.defaultField, 0];
          if (str.length > 0) {
            if (!isValue(str[0])) {
              return { params, length: length - str.length };
            }
            params[0] = getValue(str[0]);
            str.shift();
            if (str.length >= 2) { // limit 10
              if (str[0].type === "space" && str[0].value === "limit") {
                str = str.slice(1);
                params[1] = parseNumber(str[0], 0);
                str.shift();
              }
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.First,
        name: 'First',
        params: [{
          name: "Number of rows",
          type: "number",
        }, {
          name: "Field",
          type: "string",
          editor: SortedFieldsEditor,
        }, {
          name: "Descending",
          type: "boolean",
        }, {
          name: "Parttition by",
          type: "string",
          editor: FieldsEditor,
        }],
        alternativesKey: "reduce",
        defaultParams: [3, "", false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const numRows = model.params[0] as number;
          const field = model.params[1] as string;
          const desc = model.params[2] as boolean;
          const partitionBy = model.params[3] as string;
          let expr = `first ${numRows} by (${field})`;
          if (desc) {
            expr += " desc";
          }
          if (partitionBy !== "") {
            expr += ` partition by (${partitionBy})`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseFirstLastPipe,
        explainHandler: () => "https://docs.victoriametrics.com/victorialogs/logsql/#first-pipe",
      },
      {
        id: VictoriaLogsOperationId.Format,
        name: 'Format',
        params: [{
          name: "Format",
          type: "string",
        }, {
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "format",
        defaultParams: ["", this.defaultField, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const format = model.params[0] as string;
          const field = model.params[1] as string;
          const condition = model.params[2] as string;
          let expr = "format "
          if (condition !== "") {
            expr += `if (${condition}) `;
          }
          expr += `'${format}'`;
          if (field !== this.defaultField) {
            expr += ` as ${quoteString(field)}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let params: string[] = ["", this.defaultField, ""];
          let length = str.length;
          params[2] = getConditionFromString(str);
          if (str.length > 0) {
            if (str[0].type !== "quote") {
              return { params, length: length - str.length };
            }
            params[0] = unquoteString(str[0].value);
            str = str.slice(1);
            if (str.length > 1) {
              if (str[0].type === "space" && str[0].value === "as") {
                str = str.slice(1);
                if (!isValue(str[0])) {
                  return { params, length: length - str.length };
                }
                params[1] = getValue(str[0]);
                str.shift();
              }
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Join,
        name: 'Join',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditor,
        }, {
          name: "Subquery",
          type: "string",
          editor: QueryEditor,
        }, {
          name: "Prefix",
          type: "string",
        }, {
          name: "Inner Join",
          type: "boolean",
          optional: true,
        }],
        alternativesKey: "combine",
        defaultParams: ["", "", "", false],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fields = model.params[0] as string;
          const subquery = model.params[1] as string;
          const prefix = model.params[2] as string;
          const innerJoin = model.params[3] as boolean;
          let expr = `join by (${fields}) (${subquery})`;
          if (innerJoin) {
            expr += " inner";
          }
          if (prefix !== "") {
            expr += ` prefix ${quoteString(prefix)}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let result: [string, string, string, boolean] = ["", "", "", false];
          do {
            if (str.length >= 3) { // join by (user) ( _time:1d {app="app2"} | stats by (user) count() app2_hits ) inner
              if (str[0].type === "space" && str[0].value === "by") {
              } else {
                break;
              }
              if (str[1].type === "bracket") {
                result[0] = str[1].raw_value.slice(1, -1);
              } else {
                break;
              }
              if (str[2].type === "bracket") {
                result[1] = str[2].raw_value.slice(1, -1);
              } else {
                break;
              }
              str = str.slice(3);
              for (let i = 0; i < 2; i++) {
                if (str.length >= 2) { // prefix "app2."
                  if (str[0].type === "space" && str[0].value === "prefix") {
                    if (isValue(str[1])) {
                      result[2] = getValue(str[1]);
                      str = str.slice(2);
                    }
                  }
                }
                if (str.length > 0) { // inner
                  if (str[0].type === "space" && str[0].value === "inner") {
                    result[3] = true;
                    str.shift();
                  }
                }
                if (result[3] && result[2] !== "") {
                  break;
                }
              }
            }
          } while (false);
          return { params: result, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.JsonArrayLen,
        name: 'Json array len',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }],
        alternativesKey: "count",
        defaultParams: ["", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const resultField = model.params[1] as string;
          let expr = `json_array_len(${quoteString(field)}) as ${quoteString(resultField)}`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => parseLenPipe(str, "json_array_len"),
      },
      {
        id: VictoriaLogsOperationId.Hash,
        name: 'Hash',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }],
        alternativesKey: "hash",
        defaultParams: ["", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const resultField = model.params[1] as string;
          let expr = `hash(${quoteString(field)}) as ${quoteString(resultField)}`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => parseLenPipe(str, "hash"),
      },
      {
        id: VictoriaLogsOperationId.Last,
        name: 'Last',
        params: [{
          name: "Number of rows",
          type: "number",
        }, {
          name: "Field",
          type: "string",
          editor: SortedFieldsEditor,
        }, {
          name: "Descending",
          type: "boolean",
        }, {
          name: "Parttition by",
          type: "string",
          editor: FieldsEditor,
        }],
        alternativesKey: "reduce",
        defaultParams: [0, "", false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const numRows = model.params[0] as number;
          const field = model.params[1] as string;
          const desc = model.params[2] as boolean;
          const partitionBy = model.params[3] as string;
          let expr = `last ${numRows} by (${quoteString(field)})`;
          if (desc) {
            expr += " desc";
          }
          if (partitionBy !== "") {
            expr += ` partition by (${partitionBy})`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseFirstLastPipe,
      },
      {
        id: VictoriaLogsOperationId.Len,
        name: 'Len',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }],
        alternativesKey: "count",
        defaultParams: ["", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const resultField = model.params[1] as string;
          let expr = `len(${quoteString(field)}) as ${quoteString(resultField)}`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => parseLenPipe(str, "len"),
      },
      {
        id: VictoriaLogsOperationId.Limit,
        name: 'Limit',
        params: [{
          name: "Number of rows",
          type: "string",
        }],
        alternativesKey: "reduce",
        defaultParams: [10],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const number = model.params[0] as number;
          let expr = "limit " + number;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [parseNumber(str[0], 10)], length: 1 };
        },
      },
      {
        id: VictoriaLogsOperationId.Math,
        name: 'Math',
        params: [{
          name: "",
          type: "string",
          restParam: true,
          editor: MathExprEditor,
        }],
        defaultParams: [""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const expr = "math " + model.params.join(', ');
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let expressions: string[] = [];
          let expr = "";
          let field = "";
          let exprFinised = false;
          while (str.length > 0) {
            if (!exprFinised) {
              if (str[0].type === "quote") {
                expr += str[0].value;
                str = str.slice(1);
                exprFinised = true;
                if (str.length > 0) {
                  if (str[0].type === "space" && str[0].value === "as") {
                    str.shift();
                    if (str.length === 0) {
                      expressions.push(`${expr} as `);
                    }
                  }
                }
              } else if (str[0].type === "space" && str[0].value === "as") {
                str.shift();
                exprFinised = true;
                if (str.length === 0) {
                  expressions.push(`${expr} as `);
                }
              } else if (str[0].type === "space" && str[0].value === ",") {
                exprFinised = true;
              } else if (str[0].type === "space") {
                expr += str[0].value + " ";
                str.shift();
              } else if (str[0].type === "bracket") {
                expr += str[0].raw_value;
                str.shift();
              }
            } else {
              if (str[0].value !== ",") {
                if (!isValue(str[0])) {
                  break;
                }
                field = getValue(str[0]);
                str.shift();
              }
              expressions.push(`${expr} as ${quoteString(field)}`);
              expr = "";
              field = "";
              exprFinised = false;
              if (str.length > 0 && str[0].type === "space" && str[0].value === ",") {
                str.shift();
                if (str.length === 0) {
                  expressions.push("");
                }
              } else {
                break;
              }
            }
          }
          if (expressions.length === 0) {
            expressions.push("");
          }
          return { params: expressions, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Offset,
        name: 'Offset',
        params: [{
          name: "Row offset",
          type: "number",
        }],
        defaultParams: [0],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const offset = model.params[0] as number;
          let expr = "offset " + offset;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [parseNumber(str[0], 10)], length: 1 };
        },
      },
      {
        id: VictoriaLogsOperationId.PackJSON,
        name: 'Pack JSON',
        params: [{
          name: "Source fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Destination field",
          type: "string",
          editor: ResultFieldEditor,
        }],
        alternativesKey: "pack",
        defaultParams: ["", this.defaultField],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const sourceFields = model.params[0] as string;
          const destField = model.params[1] as string;
          let expr = "pack_json";
          if (sourceFields !== "") {
            expr += ` fields (${sourceFields})`;
          }
          expr += ` as ${quoteString(destField)}`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: this.parsePackPipe,
      },
      {
        id: VictoriaLogsOperationId.PackLogfmt,
        name: 'Pack logfmt',
        params: [{
          name: "Source fields",
          type: "string",
          editor: FieldsEditor,
        }, {
          name: "Destination field",
          type: "string",
          editor: ResultFieldEditor,
        }],
        alternativesKey: "pack",
        defaultParams: ["", this.defaultField],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const sourceFields = model.params[0] as string;
          const destField = model.params[1] as string;
          let expr = "pack_logfmt";
          if (sourceFields !== "") {
            expr += ` fields (${sourceFields})`;
          }
          expr += ` as ${quoteString(destField)}`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: this.parsePackPipe,
      },
      {
        id: VictoriaLogsOperationId.Rename,
        name: 'Rename',
        params: [{
          name: "Field",
          type: "string",
          restParam: true,
          editor: FieldAsFieldEditor,
        }],
        alternativesKey: "change",
        defaultParams: [""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fields = model.params.filter((v) => Boolean(v) || v === "");
          if (fields.length === 0) {
            return innerExpr;
          }
          const expr = 'rename ' + fields.join(', ')
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseFieldMapList,
      },
      {
        id: VictoriaLogsOperationId.Replace,
        name: 'Replace',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Old value",
          type: "string",
        }, {
          name: "New value",
          type: "string",
        }, {
          name: "Limit",
          type: "number",
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "replace",
        defaultParams: ["", "", "", 0, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const oldValue = model.params[1] as string;
          const newValue = model.params[2] as string;
          const limit = model.params[3] as number;
          const condition = model.params[4] as string;
          let expr = "replace";
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          expr += ` (${quoteString(oldValue, false)}, ${quoteString(newValue, false)})`;
          if (field !== this.defaultField) {
            expr += ` at ${quoteString(field)}`;
          }
          if (limit > 0) {
            expr += " limit " + limit;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: [string, string, string, number, string] = ["", "", "", 0, ""];
          params[4] = getConditionFromString(str);
          do {
            if (str.length > 0) { // replace ("secret-password", "***") at _msg
              if (str[0].type !== "bracket") {
                break;
              }
              const values = str[0].value;
              if (values.length < 2) {
                break;
              }
              if (isValue(values[0])) {
                params[1] = getValue(values[0]);
              }
              if (values.length === 2 && values[1].value === ",") {
                params[2] = "";
              } else if (isValue(values[2])) {
                params[2] = getValue(values[2]);
              }
              str = str.slice(1);
              if (str.length > 0) {
                if (str[0].type === "space" && str[0].value === "at") {
                  str = str.slice(1);
                  if (str.length > 0 && isValue(str[0])) {
                    params[0] = getValue(str[0]);
                    str.shift();
                  }
                }
              }
              if (str.length >= 2) {
                if (str[0].type === "space" && str[0].value === "limit") {
                  str = str.slice(1);
                  if (isValue(str[0])) {
                    params[3] = parseInt(getValue(str[0]), 10);
                    str.shift();
                  }
                }
              }
            }
          } while (false);
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.ReplaceRegexp,
        name: 'Replace regex',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Regexp",
          type: "string",
        }, {
          name: "Replacement",
          type: "string",
        }, {
          name: "Limit",
          type: "number",
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "replace",
        defaultParams: ["", "", "", 0, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const oldValue = model.params[1] as string;
          const newValue = model.params[2] as string;
          const limit = model.params[3] as number;
          const condition = model.params[4] as string;
          let expr = "replace_regexp";
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          expr += ` (${quoteString(oldValue, false)}, ${quoteString(newValue, false)})`;
          if (field !== this.defaultField) {
            expr += ` at ${quoteString(field)}`;
          }
          if (limit > 0) {
            expr += " limit " + limit;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: [string, string, string, number, string] = ["", "", "", 0, ""];
          params[4] = getConditionFromString(str);
          do {
            if (str.length > 0) { // replace_regexp ("host-(.+?)-foo", "$1") at _msg
              if (str[0].type !== "bracket") {
                break;
              }
              const values = str[0].value;
              if (values.length < 2) {
                break;
              }
              if (values.length > 0 && isValue(values[0])) {
                params[1] = getValue(values[0]);
              }
              if (values.length === 2 && values[1].value === ",") {
                params[2] = "";
              } else if (values.length > 2 && isValue(values[2])) {
                params[2] = getValue(values[2]);
              }
              str = str.slice(1);
              if (str.length > 0) {
                if (str[0].type === "space" && str[0].value === "at") {
                  str = str.slice(1);
                  if (str.length > 0 && isValue(str[0])) {
                    params[0] = getValue(str[0]);
                    str.shift();
                  }
                }
              }
              if (str.length >= 2) {
                if (str[0].type === "space" && str[0].value === "limit") {
                  str = str.slice(1);
                  if (isValue(str[0])) {
                    params[3] = parseInt(getValue(str[0]), 10);
                    str.shift();
                  }
                }
              }
            }
          } while (false);
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Sample,
        name: 'Sample',
        params: [{
          name: "1/N of Samples",
          type: "number",
        }],
        alternativesKey: "reduce",
        defaultParams: [1],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const sample = model.params[0] as number;
          let expr = "sample " + sample;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [parseNumber(str[0], 1)], length: 1 };
        },
      },
      {
        id: VictoriaLogsOperationId.Sort,
        name: 'Sort by',
        params: [{
          name: "Fields",
          type: "string",
          editor: SortedFieldsEditor,
        }, {
          name: "Descending",
          type: "boolean",
        }, {
          name: "Limit",
          type: "number",
        }, {
          name: "Offset",
          type: "number",
        }, {
          name: "Partition by",
          type: "string",
          editor: FieldsEditor,
        }],
        defaultParams: ["", false, 0, 0, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fields = model.params[0] as string;
          const descending = model.params[1] as boolean;
          const limit = model.params[2] as number;
          const offset = model.params[3] as number;
          const partitionBy = model.params[4] as string;
          let expr = "sort by (" + fields + ")";
          if (descending) {
            expr += " desc";
          }
          if (partitionBy !== "") {
            expr += ` partition by (${partitionBy})`;
          }
          if (limit > 0) {
            expr += " limit " + limit;
          }
          if (offset > 0) {
            expr += " offset " + offset;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => { // sort by (foo, bar) desc
          let length = str.length;
          let result: [string, boolean, number, number, string] = ["", false, 0, 0, ""];
          if (str.length > 0) {
            if (str[0].type === "space" && str[0].value === "by") {
              str.shift();
            }
            if (str[0].type === "bracket") {
              result[0] = str[0].raw_value.slice(1, -1);
            } else {
              return { params: result, length: length - str.length };
            }
            str = str.slice(1);
            while (str.length > 0) {
              if (str.length > 1 && str[0].type === "space" && str[0].value === "partition" && str[1].type === "space" && str[1].value === "by") {
                str = str.slice(2);
                if (str.length > 0 && str[0].type === "bracket") {
                  result[4] = buildSplitString(str[0].value);
                  str.shift();
                }
              } else if (str[0].type === "space" && str[0].value === "limit") {
                str = str.slice(1);
                if (str.length > 0) {
                  if (str[0].type !== "bracket") {
                    result[2] = parseInt(str[0].value, 10);
                  }
                  str.shift();
                }
              } else if (str[0].type === "space" && str[0].value === "offset") {
                str = str.slice(1);
                if (str.length > 0) {
                  if (str[0].type !== "bracket") {
                    result[3] = parseInt(str[0].value, 10);
                  }
                  str.shift();
                }
              } else if (str[0].type === "space" && str[0].value === "desc") {
                result[1] = true;
                str.shift();
              } else {
                break;
              }
            }
          }
          return { params: result, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Stats,
        name: 'Stats',
        params: [{
          name: "Stats by",
          type: "string",
        }, {
          name: "Stats",
          type: "string",
          editor: StatsEditor,
        }],
        defaultParams: ["", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const statsBy = model.params[0] as string;
          const subqueryField = model.params[1] as unknown;
          const subquery = (typeof subqueryField === "string") ? subqueryField : (subqueryField as { expr: string }).expr;
          let expr = "stats";
          if (statsBy !== "") {
            expr += ` by (${statsBy})`;
          }
          expr += " " + subquery;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let params: string[] = [""];
          let length = str.length;
          if (str.length > 0) { // check for stats by fields
            if (str[0].type === "space" && str[0].value === "by") { // optional
              str.shift();
            }
            if (str[0].type === "bracket" && str[0].prefix === "") {
              params[0] = str[0].raw_value.slice(1, -1);
              str = str.slice(1);
            }
          }
          params[1] = buildSplitString(str);
          return { params, length: length }; // everything of str
        },
      },
      {
        id: VictoriaLogsOperationId.StreamContext,
        name: 'Stream context',
        params: [{
          name: "Before",
          type: "number",
        }, {
          name: "After",
          type: "number",
        }, {
          name: "Time window",
          type: "string",
        }],
        defaultParams: [0, 0, "1h"],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const before = model.params[0] as number;
          const after = model.params[1] as number;
          const time_window = model.params[2];
          let expr = "stream_context";
          if (before > 0) {
            expr += " before " + before;
          }
          if (after > 0) {
            expr += " after " + after;
          }
          if (time_window !== "1h" && time_window !== "") {
            expr += " time_window " + time_window;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let before = 0;
          let after = 0;
          let length = str.length;
          let time_window = "1h";
          let i = 0;
          while (str.length >= 2) {
            if (i === 3) {
              break; // max 3 params
            }
            if (str[0].type === "space" && str[0].value === "before") {
              str = str.slice(1);
              if (isValue(str[0])) {
                before = parseInt(getValue(str[0]), 10);
              }
              i++;
              str.shift();
            } else if (str[0].type === "space" && str[0].value === "after") {
              str = str.slice(1);
              if (isValue(str[0])) {
                after = parseInt(getValue(str[0]), 10);
              }
              i++;
              str.shift();
            } else if (str[0].type === "space" && str[0].value === "time_window") {
              str = str.slice(1);
              if (isValue(str[0])) {
                time_window = getValue(str[0]);
              }
              i++;
              str.shift();
            } else {
              break;
            }
          }
          return { params: [before, after, time_window], length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.TimeAdd,
        name: 'Time add',
        params: [{
          name: "Duration",
          type: "string",
        }, {
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }],
        alternativesKey: "time",
        defaultParams: ["1h", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const duration = model.params[0] as string;
          const field = model.params[1] as string;
          let expr = `time_add ${duration}`;
          if (field !== "") {
            expr += ` at ${quoteString(field)}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          const length = str.length;
          const params: [string, string] = ["1h", ""];
          if (str.length > 0) {
            if (str[0].type === "quote") {
              params[0] = str[0].value;
              str.shift();
            } else if (str[0].type === "space") {
              params[0] = str[0].value;
              str.shift();
              if (str.length > 0 && params[0] === "-") {
                params[0] += str[0].value;
                str.shift();
              }
            } else {
              return { params, length: length - str.length };
            }
            if (str.length > 0 && str[0].type === "space" && str[0].value === "at") {
              str.shift();
              if (str.length > 0 && isValue(str[0])) {
                params[1] = getValue(str[0]);
                str.shift();
              }
            }
          }
          return { params, length: length - str.length };
        }
      },
      {
        id: VictoriaLogsOperationId.Top,
        name: 'Top',
        params: [{
          name: "Top Number",
          type: "number",
        }, {
          name: "Fields",
          type: "string",
          editor: FieldsEditor,
        }, {
          name: "Hits field name",
          type: "string",
        }, {
          name: "Add rank",
          type: "boolean",
        }, {
          name: "Rank field name",
          type: "string",
          editor: ResultFieldEditor,
        }],
        alternativesKey: "reduce",
        defaultParams: [10, "", "", false, "rank"],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const topNumber = model.params[0] as number;
          const fields = model.params[1] as string;
          const hitsFieldName = model.params[2] as string;
          const addRank = model.params[3] as boolean;
          const rankFieldName = model.params[4] as string;
          let expr = "top ";
          if (topNumber !== 10) {
            expr += topNumber + " ";
          }
          expr += `by (${fields})`;
          if (hitsFieldName !== "") {
            expr += ` hits as ${quoteString(hitsFieldName)}`;
          }
          if (addRank) {
            expr += " rank";
            if (rankFieldName !== "rank") {
              expr += " as " + quoteString(rankFieldName);
            }
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let result: [number, string, string, boolean, string] = [10, "", "", false, "rank"];
          if (str.length > 0) {
            if (str[0].type === "space" || str[0].type === "quote") {
              const value = getValue(str[0]).replace("_", "");
              if (!Number.isNaN(parseInt(value, 10))) {
                result[0] = parseInt(value, 10);
                str.shift();
              }
            }
            if (str.length > 0) {
              if (str[0].type === "space" && str[0].value === "by") {
                str = str.slice(1);
              }
              if (str[0].type === "bracket") {
                result[1] = str[0].raw_value.slice(1, -1);
                str.shift();
              } else if (isValue(str[0])) {
                const values = getFieldList(str);
                result[1] = values.join(", ");
              } else {
                return { params: result, length: length - str.length };
              }
            }
            let i = 0;
            while (str.length > 0 && i < 2) {
              if (str.length >= 3 && str[0].type === "space" && str[0].value === "hits" && str[1].type === "space" && str[1].value === "as") {
                str = str.slice(2);
                if (isValue(str[0])) {
                  result[2] = getValue(str[0]);
                  str.shift();
                  i++;
                }
              } else if (str[0].type === "space" && (str[0].value === "rank" || str[0].value === "with")) {
                if (str[0].value === "with") {
                  str.shift();
                }
                result[3] = true;
                str = str.slice(1);
                i++;
                if (str.length >= 2 && str[0].type === "space" && str[0].value === "as") {
                  str = str.slice(1);
                  if (isValue(str[0])) {
                    result[4] = getValue(str[0]);
                    str.shift();
                  }
                }
              } else {
                break;
              }
            }
          }
          return { params: result, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Union,
        name: 'Union',
        params: [{
          name: "",
          type: "string",
          editor: QueryEditor,
        }],
        alternativesKey: "combine",
        defaultParams: [""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const expr = "union (" + model.params[0] + ")";
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let query = "";
          if (str.length > 0) {
            if (str[0].type === "bracket") {
              query = str[0].raw_value.slice(1, -1);
              str.shift();
            }
          }
          return { params: [query], length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Uniq,
        name: 'Uniq',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditor,
        }, {
          name: "With hits",
          type: "boolean",
        }, {
          name: "Limit",
          type: "number",
        }],
        alternativesKey: "reduce",
        defaultParams: ["", false, 0],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fields = model.params[0] as string;
          const withHits = model.params[1] as boolean;
          const limit = model.params[2] as number;
          let expr = `uniq (${fields})`;
          if (limit > 0) {
            expr += " limit " + limit;
          }
          if (withHits) {
            expr += " with hits";
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let withHits = false;
          let fields = "";
          let limit = 0;
          let Length = str.length;

          if (str.length > 0) {
            if (str[0].type === "space" && str[0].value === "by") {
              str.shift();
            }
          }
          // Check for "by (fields)"
          if (str.length > 0) {
            if (str[0].type === "bracket") {
              fields = str[0].raw_value.slice(1, -1);
              str = str.slice(1);
            } else if (isValue(str[0])) {
              let values = getFieldList(str);
              fields = values.join(", ");
            } else {
              return {
                params: [fields, withHits, limit],
                length: Length - str.length,
              }
            }
          }
          let i = 0;
          while (str.length >= 2) {
            if (i === 2) {
              break; // max 2 params
            } else if (
              // Check for "with hits"
              str[0].type === "space" && str[0].value === "with" &&
              str[1].type === "space" && str[1].value === "hits"
            ) {
              withHits = true;
              str = str.slice(2);
            } else if (str[0].type === "space" && str[0].value === "limit") {
              // uniq by (host, path) limit 100
              str = str.slice(1);
              if (isValue(str[0])) {
                limit = parseInt(getValue(str[0]), 10);
              }
              str.shift();
            }
            i++;
          }
          return {
            params: [fields, withHits, limit],
            length: Length - str.length,
          }
        },
      },
      {
        id: VictoriaLogsOperationId.UnpackJson,
        name: 'Unpack JSON',
        params: [{
          name: "Unpack from field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Fields to unpack",
          type: "string",
          editor: UnpackedFieldsSelector("unpack_json"),
        }, {
          name: "Result prefix",
          type: "string",
        }, {
          name: "Keep original fields",
          type: "boolean",
        }, {
          name: "Skip empty results",
          type: "boolean",
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "unpack",
        defaultParams: [this.defaultField, "", "", "", false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fromField = model.params[0] as string;
          const fields = model.params[1] as string;
          const resultPrefix = model.params[2] as string;
          const keepOriginalFields = model.params[3] as boolean;
          const skipEmptyResults = model.params[4] as boolean;
          const condition = model.params[5] as string;
          let expr = "unpack_json";
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          if (fromField !== this.defaultField) {
            expr += ` from ${quoteString(fromField)}`;
          }
          if (fields !== "") {
            expr += ` fields (${fields})`;
          }
          if (resultPrefix !== "") {
            expr += ` result_prefix ${quoteString(resultPrefix)}`;
          }
          if (keepOriginalFields) {
            expr += " keep_original_fields";
          }
          if (skipEmptyResults) {
            expr += " skip_empty_results";
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let len = str.length;
          const condition = getConditionFromString(str);
          const conLength = len - str.length;
          const { fromField, fields, resultPrefix, keepOriginalFields, skipEmptyResults, length } = this.parseUnpackPipe(str);
          return {
            params: [fromField, fields, resultPrefix, keepOriginalFields, skipEmptyResults, condition],
            length: conLength + length,
          }
        },
      },
      {
        id: VictoriaLogsOperationId.UnpackLogfmt,
        name: 'Unpack logfmt',
        params: [{
          name: "Unpack from field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Fields to unpack",
          type: "string",
          editor: UnpackedFieldsSelector("unpack_logfmt"),
        }, {
          name: "Result prefix",
          type: "string",
        }, {
          name: "Keep original fields",
          type: "boolean",
        }, {
          name: "Skip empty results",
          type: "boolean",
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "unpack",
        defaultParams: [this.defaultField, "", "", "", false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fromField = model.params[0] as string;
          const fields = model.params[1] as string;
          const resultPrefix = model.params[2] as string;
          const keepOriginalFields = model.params[3] as boolean;
          const skipEmptyResults = model.params[4] as boolean;
          const condition = model.params[5] as string;
          let expr = "unpack_logfmt";
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          if (fromField !== this.defaultField) {
            expr += ` from ${quoteString(fromField)}`;
          }
          if (fields !== "") {
            expr += ` fields (${fields})`;
          }
          if (resultPrefix !== "") {
            expr += ` result_prefix ${quoteString(resultPrefix)}`;
          }
          if (keepOriginalFields) {
            expr += " keep_original_fields";
          }
          if (skipEmptyResults) {
            expr += " skip_empty_results";
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let len = str.length;
          const condition = getConditionFromString(str);
          const conLength = len - str.length;
          const { fromField, fields, resultPrefix, keepOriginalFields, skipEmptyResults, length } = this.parseUnpackPipe(str);
          return {
            params: [fromField, fields, resultPrefix, keepOriginalFields, skipEmptyResults, condition],
            length: conLength + length,
          }
        },
      },
      {
        id: VictoriaLogsOperationId.UnpackSyslog,
        name: 'Unpack syslog',
        params: [{
          name: "Unpack from field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Fields to unpack",
          type: "string",
          editor: UnpackedFieldsSelector("unpack_syslog"),
        }, {
          name: "Result prefix",
          type: "string",
        }, {
          name: "Keep original fields",
          type: "boolean",
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }, {
          name: "Time offset",
          type: "string",
        }],
        alternativesKey: "unpack",
        defaultParams: [this.defaultField, "", "", false, "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fromField = model.params[0] as string;
          const fields = model.params[1] as string;
          const resultPrefix = model.params[2] as string;
          const keepOriginalFields = model.params[3] as boolean;
          const condition = model.params[4] as string;
          const timeOffset = model.params[5] as string;
          let expr = "unpack_syslog";
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          if (fromField !== this.defaultField) {
            expr += ` from ${quoteString(fromField)}`;
          }
          if (fields !== "") {
            expr += ` fields (${fields})`;
          }
          if (resultPrefix !== "") {
            expr += ` result_prefix ${quoteString(resultPrefix)}`;
          }
          if (keepOriginalFields) {
            expr += " keep_original_fields";
          }
          if (timeOffset !== "") {
            expr += " offset " + timeOffset;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let len = str.length;
          const condition = getConditionFromString(str);
          const conLength = len - str.length;
          const { fromField, fields, resultPrefix, keepOriginalFields, offset, length } = this.parseUnpackPipe(str);
          return {
            params: [fromField, fields, resultPrefix, keepOriginalFields, condition, offset],
            length: conLength + length,
          };
        },
      },
      {
        id: VictoriaLogsOperationId.UnpackWords,
        name: 'Unpack words',
        params: [{
          name: "From field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Dst field",
          type: "string",
        }, {
          name: "Drop duplicates",
          type: "boolean",
        }],
        alternativesKey: "unpack",
        defaultParams: [this.defaultField, "", false],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fromField = model.params[0] as string;
          const dstField = model.params[1] as string;
          const dropDuplicates = model.params[2] as boolean;
          let expr = "unpack_words";
          expr += ` from ${quoteString(fromField)}`;
          if (dstField !== "") {
            expr += ` as ${quoteString(dstField)}`;
          }
          if (dropDuplicates) {
            expr += " drop_duplicates";
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: [string, string, boolean] = [this.defaultField, "", false];
          if (str.length > 0) {
            if (str[0].type === "space" && str[0].value === "from") {
              str.shift();
            }
            if (str.length > 0 && isValue(str[0])) {
              params[0] = getValue(str[0]);
              str.shift();
            }
            if (str.length > 0 && str[0].type === "space" && str[0].value === "as") {
              str = str.slice(1);
              if (str.length > 0 && isValue(str[0])) {
                params[1] = getValue(str[0]);
                str.shift();
              }
            }
            if (str.length > 0 && str[0].type === "space" && str[0].value === "drop_duplicates") {
              params[2] = true;
              str.shift();
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Unroll,
        name: 'Unroll',
        params: [{
          name: "Unroll from fields",
          type: "string",
          editor: FieldsEditor,
        }, {
          name: "Condition",
          type: "string",
          editor: this.conditionalEditor,
        }],
        alternativesKey: "unpack",
        defaultParams: ["", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Pipes,
        renderer: (model, def, innerExpr) => {
          const fields = model.params[0] as string;
          const condition = model.params[1] as string;
          let expr = "unroll";
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          if (fields !== "") {
            expr += ` (${fields})`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let params: [fields: string, condition: string] = ["", ""];
          let length = str.length;
          params[1] = getConditionFromString(str);
          if (str.length > 0) {
            if (str[0].type === "space" && str[0].value === "by") {
              str.shift();
            }
          }
          if (str.length > 0) {
            if (str[0].type === "bracket") {
              params[0] = str[0].raw_value.slice(1, -1);
              str.shift();
            } else if (isValue(str[0])) {
              let values = getFieldList(str);
              params[0] = values.join(", ");
            }
          }
          return { params, length: length - str.length };
        },
      }
    ];
  }

  getStatsDefinitions(): VictoriaQueryBuilderOperationDefinition[] {
    return [
      {
        id: VictoriaLogsOperationId.Avg,
        name: 'Avg',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.Count,
        name: 'Count',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.CountEmpty,
        name: 'Count empty',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Limit",
          type: "string",
          editor: NumberEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", 0, "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(true),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(true),
      },
      {
        id: VictoriaLogsOperationId.CountUniq,
        name: 'Count uniq',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditor,
        }, {
          name: "Limit",
          type: "string",
          editor: NumberEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", 0, "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(true),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(true),
      },
      {
        id: VictoriaLogsOperationId.CountUniqHash,
        name: 'Count uniq hash',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.Histogram,
        name: 'Histogram',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.JsonValues,
        name: 'Json values',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Limit",
          type: "string",
          editor: NumberEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", 0, "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(true),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(true),
      },
      {
        id: VictoriaLogsOperationId.Max,
        name: 'Max',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.Median,
        name: 'Median',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.Min,
        name: 'Min',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.Quantile,
        name: 'Quantile',
        params: [{
          name: "Percentile",
          type: "number",
          placeholder: "Nth",
          description: "Percentile value (0-100)",
        }, {
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["5", "", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: (model, def, innerExpr) => {
          const percentile = model.params[0] as number;
          const fields = model.params[1] as string;
          const resultField = model.params[2] as string;
          const condition = model.params[3] as string;
          let expr = `quantile(0.${percentile}, ${fields})`;
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          if (resultField !== "") {
            expr += ` ${quoteString(resultField)}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let params: [number, string, string, string] = [5, "", "", ""];
          const length = str.length;
          if (str.length > 0) {
            if (str[0].type === "space") {
              str.shift();
            }
            if (str[0].type === "bracket") {
              const value = str[0].value;
              if (value.length > 0) {
                const phi = value.shift();
                if (phi) {
                  let percentile = getValue(phi);
                  percentile = percentile.replace(/^0\./, "");
                  params[0] = Number.parseInt(percentile, 10);
                }
                if (value.length > 0 && value[0].value === ",") {
                  value.shift();
                }
                params[1] = buildSplitString(value);
              }
              str.shift();
            }
            params[3] = getConditionFromString(str);
            params[2] = getFieldValue(str);
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Rate,
        name: 'Rate',
        params: [{
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: (model, def, innerExpr) => {
          const resultField = model.params[0] as string;
          const condition = model.params[1] as string;
          let expr = "rate()";
          if (condition !== "") {
            expr += ` if (${condition})`;
          }
          if (resultField !== "") {
            expr += ` ${quoteString(resultField)}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let params: [string, string] = ["", ""];
          const length = str.length;
          if (str.length > 0) {
            if (str[0].type === "bracket" && str[0].prefix === "rate") {
              str.shift();
            } else if (str[0].type === "space" && str[0].value === "rate") {
              str = str.slice(2);
            }
          }
          params[1] = getConditionFromString(str);
          params[0] = getFieldValue(str);
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.RateSum,
        name: 'Rate sum',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.RowAny,
        name: 'Row any',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.RowMax,
        name: 'Row max',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.RowMin,
        name: 'Row min',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.Sum,
        name: 'Sum',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.SumLen,
        name: 'Sum len',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      },
      {
        id: VictoriaLogsOperationId.UniqValues,
        name: 'Uniq values',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Limit",
          type: "string",
          editor: NumberEditor,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", 0, "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(true),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(true),
      },
      {
        id: VictoriaLogsOperationId.Values,
        name: 'Values',
        params: [{
          name: "Fields",
          type: "string",
          editor: FieldsEditorWithPrefix,
        }, {
          name: "Result field",
          type: "string",
          editor: ResultFieldEditor,
        }, {
          name: 'Condition',
          type: 'string',
          editor: this.conditionalEditor,
        }],
        alternativesKey: "stats",
        defaultParams: ["", "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Stats,
        renderer: renderStatsOperation(false),
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: parseStatsOperation(false),
      }
    ];
  }

  getSpecialDefinitions(): VictoriaQueryBuilderOperationDefinition[] {
    return [{
      id: VictoriaLogsOperationId.Options,
      name: 'Options',
      params: [{
        name: "Query concurrency",
        type: "number",
      }, {
        name: "Ignore globel time filter",
        type: "boolean",
      }],
      defaultParams: [0, false],
      toggleable: true,
      category: VictoriaLogsQueryOperationCategory.Special,
      renderer: (model, def, innerExpr) => {
        const queryConcurrency = model.params[0] as number;
        const ignoreGlobalTimeFilter = model.params[1] as boolean;
        let expr = "options(";
        if (queryConcurrency > 0) {
          expr += "concurrency=" + queryConcurrency;
        }
        if (ignoreGlobalTimeFilter) {
          if (queryConcurrency > 0) {
            expr += ",";
          }
          expr += "ignore_global_time_filter=true";
        }
        expr += ")";
        return pipeExpr(innerExpr, expr);
      },
      addOperationHandler: addVictoriaOperation,
      splitStringByParams: (str: SplitString[]) => {
        let params: [number, boolean] = [0, false];
        if (str.length > 0) {
          if (str[0].value === "options") {
            str.shift();
          }
          if (str.length > 0 && str[0].type === "bracket") {
            for (const value of str[0].raw_value.slice(1, -1).split(",")) {
              const trimmedValue = value.trim();
              if (trimmedValue.startsWith("concurrency")) {
                const parts = trimmedValue.split("=");
                if (parts.length === 2) {
                  params[0] = parseInt(parts[1], 10);
                }
              } else if (trimmedValue.startsWith("ignore_global_time_filter")) {
                if (trimmedValue.endsWith("=true")) {
                  params[1] = true;
                } else if (trimmedValue.endsWith("=false")) {
                  params[1] = false;
                }
              }
            };
            str.shift();
          }
        }
        return { params, length: str.length };
      },
    }, {
      id: VictoriaLogsOperationId.FieldContainsAnyValueFromVariable,
      name: 'Field contains any value from Variable',
      params: [{
        name: "Field",
        type: "string",
        editor: FieldEditor,
      }, {
        name: "Variable",
        type: "string",
        editor: VariableEditor,
      }],
      defaultParams: [this.defaultField, ""],
      toggleable: true,
      category: VictoriaLogsQueryOperationCategory.Special,
      renderer: (model, def, innerExpr) => {
        const field = model.params[0] as string;
        const variable = model.params[1] as string;
        let expr = "";
        if (field !== this.defaultField) {
          expr = quoteString(field) + ":";
        }
        expr += `(${variable})`;
        return pipeExpr(innerExpr, expr);
      },
      addOperationHandler: addVictoriaOperation,
      splitStringByParams: (str: SplitString[], fieldName?: string) => {
        let length = str.length;
        let params: [string, string] = ["", ""];
        params[0] = fieldName || this.defaultField;
        if (str.length > 0) {
          if (str[0].type === "bracket") {
            params[1] = str[0].raw_value.slice(1, -1);
            str.shift();
          }
        }
        return { params, length: length - str.length };
      },
    }, {
      id: VictoriaLogsOperationId.Comment,
      name: 'Comment',
      params: [{
        name: "Comment",
        type: "string",
      }],
      defaultParams: [""],
      toggleable: true,
      category: VictoriaLogsQueryOperationCategory.Special,
      renderer: (model, def, innerExpr) => {
        const comment = model.params[0] as string;
        const expr = `# ${comment} \n`;
        return pipeExpr(innerExpr, expr);
      },
      addOperationHandler: addVictoriaOperation,
      splitStringByParams: (str: SplitString[]) => {
        let params: string[] = [""];
        if (str.length > 0 && str[0].type === "comment") {
          params[0] = str[0].value;
        }
        return { params, length: 1 };
      }
    }];
  }

  getOperationDefinitions(): VictoriaQueryBuilderOperationDefinition[] {
    return [
      ...this.getFilterDefinitions(),
      ...this.getPipeDefinitions(),
      ...this.getStatsDefinitions(),
      ...this.getSpecialDefinitions(),
    ];
  }

  parsePackPipe(str: SplitString[]) {
    let length = str.length;
    let params: [string, string] = ["", this.defaultField];
    if (str.length === 0) {
      return { params, length: 0 };
    }
    // fields (foo, bar) as baz
    if (str.length >= 2) {
      if (str[0].type === "space" && str[0].value === "fields") {
        str = str.slice(1);
        if (str[0].type === "bracket") {
          params[0] = str[0].raw_value.slice(1, -1);
          str.shift();
        } else {
          return { params, length: length - str.length };
        }
      }
    }
    if (str.length > 0 && str[0].type === "space" && str[0].value === "as") {
      str = str.slice(1);
      if (str.length > 0 && isValue(str[0])) {
        params[1] = getValue(str[0]);
        str.shift();
      }
    }
    return { params, length: length - str.length };
  }

  parseUnpackPipe(str: SplitString[]) {
    const strLen = str.length;
    /// (without the pipe commands)

    // unpack_json
    // unpack_json from _msg
    // unpack_json from my_json fields (foo, bar)
    // unpack_json from foo fields (ip, host) keep_original_fields
    // unpack_json fields (ip, host) skip_empty_results
    // unpack_json from foo result_prefix "foo_"

    // unpack_logfmt from foo result_prefix "foo_"
    // unpack_logfmt fields (ip, host) skip_empty_results
    // unpack_logfmt from foo fields (ip, host) keep_original_fields
    // unpack_logfmt from my_logfmt fields (foo, bar)
    // unpack_logfmt from _msg

    // unpack_syslog keep_original_fields
    // unpack_syslog from foo result_prefix "foo_"
    // unpack_syslog offset 5h30m

    let fromField = this.defaultField;
    let fields = "";
    let resultPrefix = "";
    let keepOriginalFields = false;
    let skipEmptyResults = false;
    let offset = "";
    while (str.length > 0) {
      if (str[0].type === "space" && str[0].value === "from") {
        str = str.slice(1);
        if (isValue(str[0])) {
          fromField = getValue(str[0]);
          str.shift();
        }
      } else if (str[0].type === "space" && str[0].value === "fields") {
        str = str.slice(1);
        if (str[0].type === "bracket") {
          fields = str[0].raw_value.slice(1, -1);
          str.shift();
        }
      } else if (str[0].type === "space" && str[0].value === "keep_original_fields") {
        keepOriginalFields = true;
        str.shift();
      } else if (str[0].type === "space" && str[0].value === "skip_empty_results") {
        skipEmptyResults = true;
        str.shift();
      } else if (str[0].type === "space" && str[0].value === "offset") {
        str = str.slice(1);
        if (isValue(str[0])) {
          offset = getValue(str[0]);
          str.shift();
        }
      } else if (str[0].type === "space" && str[0].value === "result_prefix") {
        str = str.slice(1);
        if (str[0].type === "quote") {
          resultPrefix = unquoteString(str[0].value);
          str.shift();
        }
      } else {
        break;
      }
    }
    return { fromField, fields, resultPrefix, keepOriginalFields, skipEmptyResults, offset, length: strLen - str.length };
  }

  getFilterDefinitions(): VictoriaQueryBuilderOperationDefinition[] {
    return [
      {
        id: VictoriaLogsOperationId.Word,
        name: 'Word',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Word",
          type: "string",
        }, {
          name: "Case Insensitive",
          type: "boolean",
        }, {
          name: "prefix",
          type: "boolean",
        }],
        defaultParams: [this.defaultField, "", false, false],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        explainHandler: () => `[word-filter](https://docs.victoriametrics.com/victorialogs/logsql/#word-filter) \\\n use \`*\` for non-empty field`,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const word = model.params[1] as string;
          const caseInsensitive = model.params[2] as boolean;
          const prefix = model.params[3] as boolean;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          let wordValue = quoteString(word);
          if (word.startsWith("$") || word === "*") {
            wordValue = word;
          }
          if (wordValue === "") {
            wordValue = '""';
          }
          if (prefix) {
            wordValue += "*";
          }
          if (caseInsensitive) {
            expr += `i(${wordValue})`;
          } else {
            expr += `${wordValue}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params = ["", "", false];
          params[0] = fieldName || this.defaultField;

          if (str.length === 0) { // value

          } else if (str[0].type === "colon" && str[0].value !== "") { // shouldn't be
            params[1] = str[0].value;
          } else if (str[0].type === "quote") { // "value"
            params[1] = unquoteString(str[0].value);
          } else if (str[0].type === "space") { // value
            params[1] = str[0].value;
          } else if (str[0].type === "bracket" && str[0].prefix === "i") { // i("value") / i(value)
            const value = str[0].value;
            if (value[0].type === "space") {
              params[1] = value[0].value;
            } else if (value[0].type === "quote") {
              params[1] = unquoteString(value[0].value);
            }
            params[2] = true; // case insensitive
          } else if (str[0].type === "bracket" && str[0].prefix === "") { // ("value") / (value)
            const value = str[0].value;
            if (isValue(value[0])) {
              params[1] = getValue(value[0]);
            }
            if (value.length > 1 && value[1].value === "*") {
              params[3] = true;
            }
          }
          str.shift();
          if (str.length > 0 && str[0].type === "space" && str[0].value === "*") {
            params[3] = true;
            str.shift();
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Time,
        name: 'Time filter',
        params: [{
          name: "Time Filter",
          type: "string",
        }, {
          name: "Time offset",
          type: "string",
        }],
        defaultParams: ["", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const timeFilter = model.params[0] as string;
          const offset = model.params[1] as string;
          let expr = "_time:" + timeFilter;
          if (offset !== "") {
            expr += ` offset ${offset}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        explainHandler: () => `[time-filter](https://docs.victoriametrics.com/victorialogs/logsql/#time-filter)`,
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let filter = "";
          let offset = "";
          if (str.length === 0) {

          } else if (str[0].type === "bracket") { // [min_time, max_time)
            filter = str[0].raw_value;
            str.shift();
          } else if (str[0].type === "space") { // min_time
            filter = str[0].value;
            str.shift();
          } else if (str[0].type === "colon" && str[0].value !== "_time") { // YYYY-MM-DDTHH:MM:SSZ
            let values: string[] = []
            do {
              values.push(str[0].value as string);
            } while (str[0].type === "colon" && (str = str.slice(1)))
            str.shift();
            filter = values.join(":")
          }
          if (str.length > 0 && str[0].type === "space" && str[0].value === "offset") {
            str = str.slice(1);
            if (isValue(str[0])) {
              offset = getValue(str[0]);
              str.shift();
            }
          }
          return { params: [filter, offset], length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.DayRange,
        name: 'Day range',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Start",
          type: "string",
          placeholder: "HH:MM",
        }, {
          name: "End",
          type: "string",
          placeholder: "HH:MM",
        }, {
          name: "Include start",
          type: "boolean",
        }, {
          name: "Include end",
          type: "boolean",
        }, {
          name: "Offset",
          type: "string",
        }],
        defaultParams: ["_time", "08:00", "18:00", false, false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const start = model.params[1] as string;
          const end = model.params[2] as string;
          const includeStart = model.params[3] as boolean;
          const includeEnd = model.params[4] as boolean;
          const offset = model.params[5] as string;
          let expr = `${field}:day_range`;
          expr += includeStart ? "[" : "("
          expr += `${start}, ${end}`;
          expr += includeEnd ? "]" : ")";
          if (offset !== "") {
            expr += ` offset ${offset}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let params: [string, string, string, boolean, boolean, string] = ["_time", "08:00", "18:00", false, false, ""];
          let length = str.length;
          params[0] = fieldName || "_time";
          if (str.length > 0) {
            if (str[0].type === "space") {
              str.shift();
            }
            if (str.length > 0 && str[0].type === "bracket") {
              const raw_value = str[0].raw_value;
              if (raw_value.startsWith("[")) {
                params[3] = true;
              }
              if (raw_value.endsWith("]")) {
                params[4] = true;
              }
              const value = raw_value.slice(1, -1).split(",");
              if (value.length === 2) {
                params[1] = value[0].trim();
                params[2] = value[1].trim();
              }
              str.shift();
            }
            if (str.length > 0 && str[0].type === "space" && str[0].value === "offset") {
              str = str.slice(1);
              if (isValue(str[0])) {
                params[5] = getValue(str[0]);
                str.shift();
              }
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.WeekRange,
        name: 'Week range',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Start",
          type: "string",
          options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        }, {
          name: "End",
          type: "string",
          options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        }, {
          name: "Include start",
          type: "boolean",
        }, {
          name: "Include end",
          type: "boolean",
        }, {
          name: "Offset",
          type: "string",
        }],
        defaultParams: ["_time", "Mon", "Fri", false, false, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const start = model.params[1] as string;
          const end = model.params[2] as string;
          const includeStart = model.params[3] as boolean;
          const includeEnd = model.params[4] as boolean;
          const offset = model.params[5] as string;
          let expr = `${field}:week_range`;
          expr += includeStart ? "[" : "("
          expr += `${start}, ${end}`;
          expr += includeEnd ? "]" : ")";
          if (offset !== "") {
            expr += ` offset ${offset}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let params: [string, string, string, boolean, boolean, string] = ["_time", "Mon", "Fri", false, false, ""];
          let length = str.length;
          params[0] = fieldName || "_time";
          if (str.length > 0) {
            if (str[0].type === "space") {
              str.shift();
            }
            if (str.length > 0 && str[0].type === "bracket") {
              const raw_value = str[0].raw_value;
              if (raw_value.startsWith("[")) {
                params[3] = true;
              }
              if (raw_value.endsWith("]")) {
                params[4] = true;
              }
              const value = raw_value.slice(1, -1).split(",");
              if (value.length === 2) {
                let startDay = value[0].trim();
                let endDay = value[1].trim();
                const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                if (startDay.length === 3) {
                  startDay = daysOfWeek.find(day => day.startsWith(startDay)) || startDay;
                }
                if (endDay.length === 3) {
                  endDay = daysOfWeek.find(day => day.startsWith(endDay)) || endDay;
                }
                params[1] = startDay;
                params[2] = endDay;
              }
              str.shift();
            }
            if (str.length > 0 && str[0].type === "space" && str[0].value === "offset") {
              str = str.slice(1);
              if (isValue(str[0])) {
                params[5] = getValue(str[0]);
                str.shift();
              }
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Stream,
        name: 'Stream',
        params: [{
          name: "Field",
          type: "string",
          restParam: true,
          editor: StreamFieldEditor,
        }],
        defaultParams: [""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const labels = model.params.join(", ");
          const expr = `{${labels}}`
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: string[] = [];
          if (str.length > 0) {
            if (str[0].type === "bracket") {
              for (const parts of splitByUnescapedChar(str[0].value, ",")) {
                params.push(buildSplitString(parts));
              }
              const value = str[0].value;
              if (value.length > 0 && value[value.length - 1].value === ",") {
                params.push("");
              }
              str.shift();
            }
          }
          if (params.length === 0) {
            params[0] = "";
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.StreamId,
        name: 'Stream ID',
        params: [{
          name: "",
          type: "string",
          editor: SubqueryEditor,
        }],
        defaultParams: [""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const subqueryField = model.params[0] as unknown;
          const subquery = (typeof subqueryField === "string") ? subqueryField : (subqueryField as { expr: string }).expr;
          const expr = `_stream_id:${subquery}`;
          return pipeExpr(innerExpr, expr);
        },
        explainHandler: () => `[stream-id-filter](https://docs.victoriametrics.com/victorialogs/logsql/#_stream_id-filter)`,
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          let length = str.length;
          let params: [string] = [""];
          if (str.length > 0) {
            if (isValue(str[0])) {
              params[0] = getValue(str[0]);
              str.shift();
            } else if (str[0].type === "bracket") {
              params[0] = str[0].raw_value;
              str.shift();
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Regexp,
        name: 'Regexp',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Expression",
          type: "string",
          placeholder: "<re>"
        }, {
          name: "Case Insensitive",
          type: "boolean",
        }],
        defaultParams: [this.defaultField, "", false],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const substr = model.params[1] as string;
          const caseInsensitive = model.params[2] as boolean;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          if (caseInsensitive) {
            expr += `~${quoteString("(?i)" + substr, true)}`;
          } else {
            expr += `~${quoteString(substr, true)}`;
          }
          return pipeExpr(innerExpr, expr);
        },
        explainHandler: () => `[regexp-filter](https://docs.victoriametrics.com/victorialogs/logsql/#regexp-filter)`,
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: [fieldName: string, substr: string, caseInsensitive: boolean] = ["", "", false];
          params[0] = fieldName || this.defaultField;
          if (str.length >= 2) {
            if (str[0].value === "~") {
              str = str.slice(1);
              if (str[0].type === "quote") {
                let substr = unquoteString(str[0].value);
                if (substr.startsWith("(?i)")) {
                  params[2] = true;
                  substr = substr.slice("(?i)".length);
                }
                params[1] = substr;
                str.shift();
              }
            }
          } else if (str.length > 0) {
            if (str[0].value === "~") {
              str.shift();
            } else {

            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.RangeComparison,
        name: 'Range comparison',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Comparison",
          type: "string",
          options: [
            { label: "equal", value: "=" },
            { label: "less than", value: "<" },
            { label: "less than or equal", value: "<=" },
            { label: "greater than", value: ">" },
            { label: "greater than or equal", value: ">=" },
          ],
        }, {
          name: "Value",
          type: "string",
          editor: NumberEditor,
        }],
        defaultParams: [this.defaultField, ">", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const comparison = model.params[1] as string;
          const value = model.params[2] as string;
          const expr = `${quoteString(field)}:${comparison}${value}`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let params = ["", "=", ""];
          params[0] = fieldName || this.defaultField;
          let length = str.length;
          if (str.length > 0 && str[0].type === "space") {
            if (["<=", ">="].includes(str[0].value.slice(0, 2))) {
              params[1] = str[0].value.slice(0, 2);
              if (str[0].value.length > 2) {
                params[2] = str[0].value.slice(2);
                str.shift();
              } else if (str.length > 1 && str[1].type === "space") {
                params[2] = str[1].value;
                str.shift();
                str.shift();
              }
            } else if (["<", ">", "="].includes(str[0].value.slice(0, 1))) {
              params[1] = str[0].value.slice(0, 1);
              if (str[0].value.length > 1) {
                params[2] = str[0].value.slice(1);
                str.shift();
              } else if (str.length > 1 && isValue(str[1])) {
                params[2] = getValue(str[1]);
                str.shift();
                str.shift();
              } else {
                str.shift();
              }
            }
          }
          return { params: params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Exact,
        name: 'Exact',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Text",
          type: "string",
          editor: ExactValueEditor,
        }, {
          name: "Not equal",
          type: "boolean",
        }, {
          name: "Exact Prefix",
          type: "boolean",
        }],
        defaultParams: [this.defaultField, "", false, false],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const text = model.params[1] as string;
          const notEqual = model.params[2] as boolean;
          const exactPrefix = model.params[3] as boolean;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += notEqual ? "!=" : "=";
          if (text.startsWith("$")) {
            expr += text; // variable
          } else if (text === "") {
            expr += '""'; // empty string
          } else {
            expr += quoteString(text);
          }
          if (exactPrefix) {
            expr += "*"; // exact prefix
          }
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: [string, string, boolean, boolean] = ["", "", false, false];
          params[0] = fieldName || this.defaultField;
          if (str.length > 0 && str[0].type === "space") { // : = "server01"
            if (str[0].value === "!") {
              params[2] = true; // not equal
              str.shift();
            }
            if (str[0].value === "=") {
              str = str.slice(1);
            }
            if (!isValue(str[0])) {
              return { params, length: length - str.length };
            }
            if (str[0].type === "quote") {
              params[1] = unquoteString(str[0].value);
              str = str.slice(1);
              if (str.length > 0 && str[0].type === "space" && str[0].value === "*") {
                params[3] = true; // exact prefix
                str.shift();
              }
            } else if (str[0].type === "space") {
              let value = str[0].value;
              if (value.endsWith("*")) {
                params[3] = true; // exact prefix
                value = value.slice(0, -1);
              }
              params[1] = value;
              str.shift();
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.MultiExact,
        name: 'Multi exact',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Matches",
          type: "string",
          editor: SubqueryEditor,
        }],
        defaultParams: [this.defaultField, "()"],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          let result = "";
          const fieldName = model.params[0] as string;
          const subqueryField = model.params[1] as unknown;
          const subquery = (typeof subqueryField === "string") ? subqueryField : (subqueryField as { expr: string }).expr;
          if (fieldName !== this.defaultField) {
            result = `${quoteString(fieldName)}:`;
          }
          result += `in${subquery}`;
          return pipeExpr(innerExpr, result);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: string[] = ["", ""];
          params[0] = fieldName || this.defaultField;
          if (str[0].type === "bracket") { // (="error" OR ="fatal")  /  in("error", "fatal")
            params[1] = str[0].raw_value;
            str.shift();
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.ContainsAll,
        name: 'Contains all',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Values",
          type: "string",
          editor: SubqueryEditor,
        }],
        defaultParams: [this.defaultField, "()"],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const subqueryField = model.params[1] as unknown;
          const subquery = (typeof subqueryField === "string") ? subqueryField : (subqueryField as { expr: string }).expr;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += "contains_all" + subquery;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: string[] = ["", ""];
          params[0] = fieldName || this.defaultField;
          if (str[0].type === "bracket" && str[0].prefix === "contains_all") { // contains_all(foo, "bar baz")
            params[1] = str[0].raw_value;
            str.shift();
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.ContainsAny,
        name: 'Contains any',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Filter",
          type: "string",
          editor: SubqueryEditor,
        }],
        defaultParams: [this.defaultField, "()"],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const subqueryField = model.params[1] as unknown;
          const subquery = (typeof subqueryField === "string") ? subqueryField : (subqueryField as { expr: string }).expr;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += "contains_any" + subquery;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: [string, string] = [fieldName || this.defaultField, ""];
          if (str.length > 0 && str[0].type === "bracket" && str[0].prefix === "contains_any") {
            params[1] = str[0].raw_value;
            str.shift();
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Sequence,
        name: 'Sequence',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Sequence",
          type: "string",
          restParam: true,
        }],
        defaultParams: [this.defaultField, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const params = model.params.slice(1).filter((v) => Boolean(v) || v === "") as string[];
          let sequence = "";
          for (let i = 0; i < params.length; i++) {
            sequence += quoteString(params[i]);
            if (params[i] === "") {
              sequence += '""';
            }
            if (i < params.length - 1) {
              sequence += ", ";
            }
          }
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += `seq(${sequence})`; // seq("foo", "bar baz")
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: string[] = [""];
          params[0] = fieldName || this.defaultField;
          if (str[0].type === "bracket" && str[0].prefix === "seq") { // seq(foo, "bar baz")
            params.push(...getValuesFromBrackets(str[0].value));
            str.shift();
          }
          if (params.length === 1) {
            params[1] = "";
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.Range,
        name: 'Range',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Lower",
          type: "string",
          editor: NumberEditor,
        }, {
          name: "Upper",
          type: "string",
          editor: NumberEditor,
        }, {
          name: "Include Lower",
          type: "boolean",
        }, {
          name: "Include Upper",
          type: "boolean",
        }],
        defaultParams: [this.defaultField, 0, 0, false, false],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const lower = model.params[1] as string;
          const upper = model.params[2] as string;
          const includeLower = model.params[3] as boolean;
          const includeUpper = model.params[4] as boolean;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += "range";
          expr += includeLower ? "[" : "("
          expr += `${lower}, ${upper}`;
          expr += includeUpper ? "]" : ")";
          return pipeExpr(innerExpr, expr);
        },
        explainHandler: () => `[range-filter](https://docs.victoriametrics.com/victorialogs/logsql/#range-filterr)`,
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: [string, string, string, boolean, boolean] = ["", "", "", false, false];
          params[0] = fieldName || this.defaultField;
          if (str.length > 0) { // range(4.2, Inf) or >4.2 (...
            if (str[0].type === "bracket" && str[0].prefix === "range") { // range(4.2, Inf)
              const results = getValuesFromBrackets(str[0].value);
              if (results.length === 2) {
                params[1] = results[0];
                params[2] = results[1];
                if (str[0].raw_value.startsWith("[")) {
                  params[3] = true;
                }
                if (str[0].raw_value.endsWith("]")) {
                  params[4] = true;
                }
              }
              str.shift();
            } else if (str[0].type === "space" && [">", ">=", "<", "<="].includes(str[0].value)) { // > 4.2 or >= 4.2
              params[0] = str[0].value;
              str.shift();
            }
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.IPv4Range,
        name: 'IPv4 range',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Start/CIDR",
          type: "string",
        }, {
          name: "End",
          type: "string",
        }],
        defaultParams: [this.defaultField, "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const start = model.params[1] as string;
          const end = model.params[2] as string;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += `ipv4_range(${start}${end ? `, ${end}` : ''})`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: [string, string, string] = ["", "", ""];
          params[0] = fieldName || this.defaultField;
          // ipv4_range(127.0.0.0, 127.255.255.255) or ipv4_range("127.0.0.0/8") or pv4_range("1.2.3.4")
          if (str.length > 0 && str[0].type === "bracket" && str[0].prefix === "ipv4_range") {
            const results = getValuesFromBrackets(str[0].value);
            if (results.length > 0) {
              params[1] = results[0];
              if (results.length > 1) {
                params[2] = results[1];
              }
            }
            str.shift();
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.StringRange,
        name: 'String range',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Start",
          type: "string",
          editor: SingleCharInput,
        }, {
          name: "End",
          type: "string",
          editor: SingleCharInput,
        }],
        defaultParams: [this.defaultField, "", ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const start = model.params[1] as string;
          const end = model.params[2] as string;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += `string_range(${start}, ${end})`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: [string, string, string] = ["", "", ""];
          params[0] = fieldName || this.defaultField;
          // string_range(A, C)
          if (str.length > 0 && str[0].type === "bracket" && str[0].prefix === "string_range") {
            const results = getValuesFromBrackets(str[0].value);
            params[1] = results[0] || "";
            params[2] = results[1] || "";
            str.shift();
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.LengthRange,
        name: 'Length range',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Start",
          type: "string",
          editor: NumberEditor,
        }, {
          name: "End",
          type: "string",
          editor: NumberEditor,
        }],
        defaultParams: [this.defaultField, "5", "10"],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const start = model.params[1] as string;
          const end = model.params[2] as string;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += `len_range(${start}, ${end})`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: [string, string, string] = ["", "5", "10"];
          params[0] = fieldName || this.defaultField;
          // len_range(5, 10) or len_range(5, inf)
          if (str.length > 0 && str[0].type === "bracket" && str[0].prefix === "len_range") {
            const results = getValuesFromBrackets(str[0].value);
            params[1] = results[0] || "5";
            params[2] = results[1] || "10";
            str.shift();
          }
          return { params, length: length - str.length };
        },
      },
      {
        id: VictoriaLogsOperationId.ValueType,
        name: 'Value type',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Type",
          type: "string",
          editor: FieldValueTypeEditor,
        }],
        defaultParams: [this.defaultField, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const type = model.params[1] as string;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += `value_type(${type})`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          return parseCompareOperation(str, fieldName || this.defaultField);
        },
      },
      {
        id: VictoriaLogsOperationId.EqField,
        name: 'Equal field',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }],
        alternativesKey: "compare",
        defaultParams: [this.defaultField, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field1 = model.params[0] as string;
          const field2 = model.params[1] as string;
          let expr = "";
          if (field1 !== this.defaultField) {
            expr = `${quoteString(field1)}:`;
          }
          expr += `eq_field(${quoteString(field2)})`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          return parseCompareOperation(str, fieldName || this.defaultField);
        },
      },
      {
        id: VictoriaLogsOperationId.LeField,
        name: 'Less or equal field',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }],
        alternativesKey: "compare",
        defaultParams: [this.defaultField, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field1 = model.params[0] as string;
          const field2 = model.params[1] as string;
          let expr = "";
          if (field1 !== this.defaultField) {
            expr = `${quoteString(field1)}:`;
          }
          expr += `le_field(${quoteString(field2)})`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          return parseCompareOperation(str, fieldName || this.defaultField);
        },
      },
      {
        id: VictoriaLogsOperationId.LtField,
        name: 'Less than field',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }],
        alternativesKey: "compare",
        defaultParams: [this.defaultField, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field1 = model.params[0] as string;
          const field2 = model.params[1] as string;
          let expr = "";
          if (field1 !== this.defaultField) {
            expr = `${quoteString(field1)}:`;
          }
          expr += `lt_field(${quoteString(field2)})`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          return parseCompareOperation(str, fieldName || this.defaultField);
        },
      },
      {
        id: VictoriaLogsOperationId.Logical,
        name: 'Logical filter',
        params: [{
          name: "Field",
          type: "string",
          editor: FieldEditor,
        }, {
          name: "Query",
          type: "string",
          editor: LogicalFilterEditor,
        }],
        defaultParams: [this.defaultField, ""],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Filters,
        renderer: (model, def, innerExpr) => {
          const field = model.params[0] as string;
          const subqueryField = model.params[1] as unknown;
          const subquery = (typeof subqueryField === "string") ? subqueryField : (subqueryField as { expr: string }).expr;
          let expr = "";
          if (field !== this.defaultField) {
            expr = `${quoteString(field)}:`;
          }
          expr += `(${subquery})`;
          return pipeExpr(innerExpr, expr);
        },
        addOperationHandler: addVictoriaOperation,
        explainHandler: () => `[logical-filter](https://docs.victoriametrics.com/victorialogs/logsql/#logical-filter)`,
        splitStringByParams: (str: SplitString[], fieldName?: string) => {
          let length = str.length;
          let params: string[] = ["", ""];
          params[0] = fieldName || this.defaultField;
          if (str.length > 0) {
            if (str[0].type === "bracket") {
              params[1] = str[0].raw_value.slice(1, -1);
              str.shift();
            }
          }
          return { params, length: length - str.length };
        },
      },
      // Operators
      {
        id: VictoriaLogsOperationId.AND,
        name: 'AND',
        params: [],
        alternativesKey: "operators",
        defaultParams: [],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Operators,
        renderer: (model, def, innerExpr) => innerExpr + 'AND',
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [], length: 0 };
        },
      },
      {
        id: VictoriaLogsOperationId.OR,
        name: 'OR',
        params: [],
        alternativesKey: "operators",
        defaultParams: [],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Operators,
        renderer: (model, def, innerExpr) => innerExpr + ' OR',
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [], length: 0 };
        },
      },
      {
        id: VictoriaLogsOperationId.NOT,
        name: 'NOT',
        params: [],
        alternativesKey: "operators",
        defaultParams: [],
        toggleable: true,
        category: VictoriaLogsQueryOperationCategory.Operators,
        renderer: (model, def, innerExpr) => innerExpr + ' NOT',
        addOperationHandler: addVictoriaOperation,
        splitStringByParams: (str: SplitString[]) => {
          return { params: [], length: 0 };
        },
      }
    ];
  }
}

function parseNumber(str: SplitString, defaultValue: undefined): number | undefined;
function parseNumber(str: SplitString, defaultValue: number): number;
function parseNumber(str: SplitString, defaultValue: number | undefined) {
  let result = defaultValue;
  if (str === undefined) { return result; }
  if (!isValue(str)) {
    return result;
  }
  let value = '';
  value = getValue(str);
  value = value.replace(/_/g, '');
  // Regex to extract only integer or float (no suffix)
  const match = value.match(/^(-?\d+(?:\.\d+)?)/);
  if (!match) { return result; }
  let num = parseFloat(match[1]);
  if (Number.isNaN(num)) { return result; }
  return num;
}

function parseFirstLastPipe(str: SplitString[]) {
  let length = str.length;
  let params: [number, string, boolean, string] = [0, "", false, ""];
  do {
    if (str.length >= 2) { // 10 by (request_duration)
      const value = parseNumber(str[0], undefined);
      if (value === undefined) {
        break;
      }
      params[0] = value;
      str.shift();
      if (str[0].type === "space" && str[0].value === "by") {
        str.shift();
      }
      if (str.length === 0 || str[0].type !== "bracket") {
        break;
      }
      params[1] = str[0].raw_value.slice(1, -1);
      str = str.slice(1);
      if (str.length > 0 && str[0].type === "space" && str[0].value === "desc") {
        params[2] = true;
        str.shift();
      }
      if (str.length >= 3) { // partition by (host)
        if (str[0].type === "space" && str[0].value === "partition") {
          if (str[1].type === "space" && str[1].value === "by") {
            if (str[2].type === "bracket") {
              params[3] = str[2].raw_value.slice(1, -1);
              str = str.slice(3);
            }
          }
        }
      }
    }
  } while (false);
  return { params, length: length - str.length };
}

function parseLenPipe(str: SplitString[], fnName: string) {
  let length = str.length;
  let params: [string, string] = ["", ""];
  if (str.length >= 2) {
    let value;
    if (str[0].type === "bracket" && str[0].prefix === fnName) {
      value = str[0].value;
      str.shift();
    } else if (str[0].type === "space" && str[0].value === fnName && str[1].type === "bracket") {
      value = str[1].value;
      str = str.slice(2);
    } else {
      return { params, length: length - str.length };
    }
    if (value.length > 0) {
      if (value[0].type === "space") {
        params[0] = value[0].value;
      } else if (value[0].type === "quote") {
        params[0] = unquoteString(value[0].value);
      }
    }
    if (str[0].type === "space" && str[0].value === "as") {
      str = str.slice(1);
      if (str.length > 0) {
        if (isValue(str[0])) {
          params[1] = getValue(str[0]);
          str.shift();
        }
      }
    }
  }
  return { params, length: length - str.length };
}

function getFieldValue(str: SplitString[], defaultValue = ""): string {
  if (str.length === 0) {
    return defaultValue;
  }
  let value = defaultValue;
  if (isValue(str[0])) {
    value = getValue(str[0]);
    if (str[0].value === ",") {
      value = defaultValue;
    } else {
      str.shift();
    }
  }
  return value;
}

function renderStatsOperation(hasLimit = false) {
  function renderStatsOperation(model: QueryBuilderOperation, def: QueryBuilderOperationDefinition, innerExpr: string): string {
    const fields = model.params[0] as string;
    let Limit = 0;
    let offset = 1;
    if (hasLimit) {
      Limit = model.params[offset++] as number;
    }
    const resultField = model.params[offset++] as string;
    const condition = model.params[offset] as string;
    const operation = model.id;
    let expr = `${operation}(${fields})`;
    if (Limit > 0) {
      expr += ` limit ${Limit}`;
    }
    if (condition !== "") {
      expr += ` if (${condition})`;
    }
    if (resultField !== "") {
      expr += ` ${quoteString(resultField)}`;
    }
    return pipeExpr(innerExpr, expr);
  }
  return renderStatsOperation;
}

type StatsParamsWithoutLimit = [field: string, resultField: string, condition: string];
type StatsParamsWithLimit = [field: string, limit: number, resultField: string, condition: string];

type StatsParamsParseFnWithLimit = (str: SplitString[]) => { params: StatsParamsWithLimit, length: number };
type StatsParamsParseFnWithoutLimit = (str: SplitString[]) => { params: StatsParamsWithoutLimit, length: number };

function parseStatsOperationWithLimit(str: SplitString[]) {
  let params: StatsParamsWithLimit = ["", 0, "", ""];
  const length = str.length;
  if (str.length > 0) {
    if (str[0].type === "space") {
      str.shift();
    }
    if (str[0].type === "bracket") {
      params[0] = str[0].raw_value.slice(1, -1);
      str.shift();
    }
    if (str.length > 0) {
      if (str[0].type === "space" && str[0].value === "limit") {
        str.shift();
        if (str.length > 0) {
          params[1] = parseNumber(str[0], 0);
          str.shift();
        }
      }
    }
    params[3] = getConditionFromString(str);
    if (str.length > 0 && str[0].value === "as") {
      str.shift();
    }
    params[2] = getFieldValue(str);
  }
  return { params, length: length - str.length };
}

function parseStatsOperationWithoutLimit(str: SplitString[]) {
  let params: StatsParamsWithoutLimit = ["", "", ""];
  const length = str.length;
  if (str.length > 0) {
    if (str[0].type === "space") {
      str.shift();
    }
    if (str[0].type === "bracket") {
      params[0] = str[0].raw_value.slice(1, -1);
      str.shift();
    }
    params[2] = getConditionFromString(str);
    if (str.length > 0 && str[0].value === "as") {
      str.shift();
    }
    params[1] = getFieldValue(str);
  }
  return { params, length: length - str.length };
}

function parseStatsOperation(hasLimit: true): StatsParamsParseFnWithLimit;
function parseStatsOperation(hasLimit: false): StatsParamsParseFnWithoutLimit;

function parseStatsOperation(hasLimit: boolean): StatsParamsParseFnWithLimit | StatsParamsParseFnWithoutLimit {
  if (hasLimit) {
    return parseStatsOperationWithLimit;
  } else {
    return parseStatsOperationWithoutLimit;
  }
}

function getFieldList(str: SplitString[]) {
  let fields: string[] = [];
  while (str.length > 0) {
    if (str[0].type === "space" || str[0].type === "quote") {
      fields.push(str[0].value);
      str.shift();
      if (str.length > 0 && str[0].value === ",") {
        str.shift();
        continue;
      }
    }
    break;
  }
  return fields;
}

function parseCompareOperation(str: SplitString[], fieldName: string) {
  let length = str.length;
  let params: string[] = [fieldName, ""];
  const compareOps = ["value_type", "eq_field", "le_field", "lt_field"];
  if (str.length > 0 && str[0].type === "bracket" && compareOps.includes(str[0].prefix)) {
    params[1] = getValuesFromBrackets(str[0].value)[0] || "";
    str.shift();
  }
  return { params, length: length - str.length };
}

function parseExtractOperation(str: SplitString[], defaultField: string) {
  let length = str.length;
  let params: [string, string, boolean, boolean, string] = [defaultField, "", false, false, ""];
  params[4] = getConditionFromString(str);
  if (str.length === 0 || str[0].type !== "quote") {
    return { params, length: 0 };
  }
  // "ip=<ip> " from _msg
  params[1] = unquoteString(str[0].value);
  str = str.slice(1);
  if (str.length >= 2) {
    if (str[0].type === "space" && str[0].value === "from") {
      str = str.slice(1);
      if (isValue(str[0])) {
        params[0] = getValue(str[0]);
        str.shift();
      }
    }
  }
  let i = 0;
  while (str.length > 0) {
    if (i >= 2) {
      break;
    } else if (str[0].type === "space") {
      if (str[0].value === "keep_original_fields") {
        str = str.slice(1);
        params[2] = true;
      } else if (str[0].value === "skip_empty_results") {
        str = str.slice(1);
        params[3] = true;
      } else {
        break;
      }
    } else {
      break;
    }
    i++;
  }
  return { params, length: length - str.length };
}

function buildExtractOperation(model: QueryBuilderOperation, innerExpr: string, defaultField: string): string {
  const modelId = model.id;
  const fromField = model.params[0] as string;
  const pattern = model.params[1] as string;
  const keepOriginalFields = model.params[2] as boolean;
  const skipEmptyResults = model.params[3] as boolean;
  const condition = model.params[4] as string;
  let expr = modelId;
  if (condition !== "") {
    expr += ` if (${condition})`;
  }
  expr += " " + quoteString(pattern, true);
  if (fromField !== defaultField) {
    expr += ` from ${quoteString(fromField)}`;
  }
  if (keepOriginalFields) {
    expr += " keep_original_fields";
  }
  if (skipEmptyResults) {
    expr += " skip_empty_results";
  }
  return pipeExpr(innerExpr, expr);
}

function parsePrefixFieldList(str: SplitString[]): string[] {
  let fields: string[] = [];
  while (str.length > 0) {
    if (str[0].type === "space" || str[0].type === "quote") {
      let value = str[0].value;
      if (str.length > 1 && str[0].type === "quote") {
        if (str[1].value === "*") {
          str.shift();
          value += "*";
        }
      }
      str.shift();
      fields.push(value);
      if (str.length > 0 && str[0].value === ",") {
        str.shift();
        continue;
      }
    }
    break;
  }
  return fields;
}
