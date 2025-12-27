
import React, { memo, useMemo } from 'react';

import { TimeRange, DataSourceApi, SelectableValue } from "@grafana/data";
import { EditorRow, LabelFilters, OperationList, OperationsEditorRow, QueryBuilderLabelFilter } from '@grafana/plugin-ui';

import { VictoriaLogsDatasource } from "../../../datasource";
import { FilterFieldType, VisualQuery } from "../../../types";

import { getVariableOptions } from "./Editors/utils/editorHelper";
import { QueryModeller } from "./QueryModellerClass";


type GetLabelFieldOptionsProps = {
  timeRange?: TimeRange;
  queryModeller: QueryModeller;
  datasource: VictoriaLogsDatasource;
  labels: QueryBuilderLabelFilter[];
  fieldType: FilterFieldType;
  fieldName?: string;
}

async function getLabelFieldOptions(props: GetLabelFieldOptionsProps): Promise<SelectableValue[]> {
  const { timeRange, queryModeller, datasource, labels, fieldType, fieldName } = props;
  const expr = queryModeller.renderLabels(labels);
  const replacedExpr = datasource.interpolateString(expr);
  const fieldList = (await datasource.languageProvider?.getFieldList({ query: replacedExpr, timeRange: timeRange, type: fieldType, field: fieldName })) || [];
  const options = fieldList.map(({ value, hits }) => ({
    value,
    label: value || " ",
    description: `hits: ${hits}`,
  }));
  options.push(...await getVariableOptions())
  return options;
}

function getPrevLabels(labels: QueryBuilderLabelFilter[], forLabel: Partial<QueryBuilderLabelFilter>): QueryBuilderLabelFilter[] {
  const idx = labels.findIndex(label => label === forLabel);
  return idx === -1 ? labels : labels.slice(0, idx);
}

interface Props {
  query: VisualQuery;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onChange: (update: VisualQuery) => void;
  onRunQuery: () => void;
  enableLabelFilters: boolean;
}

const QueryBuilder = memo<Props>(({ datasource, query, onChange, onRunQuery, timeRange, enableLabelFilters }) => {
  const queryModeller = useMemo(() => {
    return new QueryModeller([]);
  }, []);

  const onVisQueryChange = (visQuery: VisualQuery) => {
    const expr = queryModeller.renderQuery(visQuery);
    onChange({ ...visQuery, expr: expr });
  };
  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    const expr = queryModeller.renderQuery({ operations: query.operations, labels });
    onChange({ ...query, expr, labels });
  };
  const onGetLabelNames = async (forLabel: Partial<QueryBuilderLabelFilter>) => {
    const prevLabels = getPrevLabels(query.labels, forLabel);
    const options = await getLabelFieldOptions({ timeRange, queryModeller, datasource, labels: prevLabels, fieldType: FilterFieldType.FieldName });
    return options.filter((opt) => !["_stream", "_stream_id"].includes(opt.value));
  };
  const onGetLabelValues = async (forLabel: Partial<QueryBuilderLabelFilter>) => {
    if (!forLabel.label) {
      return await getVariableOptions();
    }
    const prevLabels = getPrevLabels(query.labels, forLabel);
    return await getLabelFieldOptions({ timeRange, queryModeller, datasource, labels: prevLabels, fieldType: FilterFieldType.FieldValue, fieldName: forLabel.label });
  };
  return (
    <div>
      {enableLabelFilters &&
        <EditorRow>
          <LabelFilters
            onGetLabelNames={(forLabel: Partial<QueryBuilderLabelFilter>) =>
              onGetLabelNames(forLabel)
            }
            onGetLabelValues={(forLabel: Partial<QueryBuilderLabelFilter>) =>
              onGetLabelValues(forLabel)
            }
            labelsFilters={query.labels}
            onChange={onChangeLabels}
          />
        </EditorRow>
      }
      <OperationsEditorRow>
        <OperationList
          query={query}
          datasource={datasource as DataSourceApi}
          onChange={onVisQueryChange}
          timeRange={timeRange}
          onRunQuery={onRunQuery}
          queryModeller={queryModeller}
        />
      </OperationsEditorRow>
    </div>
  )
});

QueryBuilder.displayName = 'QueryBuilder';

export default QueryBuilder;
