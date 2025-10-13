import { css } from "@emotion/css";
import React, { useMemo, useState } from "react";

import { GrafanaTheme2, SelectableValue, TimeRange } from "@grafana/data";
import { IconButton, Label, Select, useStyles2 } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../../../../datasource";
import { escapeLabelValueInExactSelector } from "../../../../../languageUtils";
import { FilterFieldType, VisualQuery } from "../../../../../types";
import { deleteByIndexPath } from "../../utils/modifyFilterVisualQuery/deleteByIndexPath";
import { updateValueByIndexPath } from "../../utils/modifyFilterVisualQuery/updateByIndexPath";
import { DEFAULT_FIELD, filterVisualQueryToString } from "../../utils/parseToString";

interface Props {
  datasource: VictoriaLogsDatasource;
  filter: string;
  query: VisualQuery;
  indexPath: number[];
  timeRange?: TimeRange;
  onChange: (query: VisualQuery) => void;
}

const QueryBuilderFieldFilter = ({ datasource, filter, query, indexPath, timeRange, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const [fieldNames, setFieldNames] = useState<SelectableValue<string>[]>([])
  const [isLoadingFieldNames, setIsLoadingFieldNames] = useState(false)

  const [fieldValues, setFieldValues] = useState<SelectableValue<string>[]>([])
  const [isLoadingFieldValues, setIsLoadingFieldValues] = useState(false)

  const { field, fieldValue } = useMemo(() => {
    const regex = /("[^"]*"|'[^']*'|\S+)\s*:\s*("[^"]*"|'[^']*'|\S+)?|\S+/i
    const matches = filter.match(regex);
    if (!matches || matches.length < 1) {
      return {};
    }
    const field = matches[1] || DEFAULT_FIELD
    const fieldValue = matches[2] ?? (matches[1] ? "" : matches[0])

    return { field, fieldValue }
  }, [filter])

  const handleRemoveFilter = () => {
    onChange({
      ...query,
      filters: deleteByIndexPath(query.filters, indexPath)
    })
  }

  const handleSelect = (type: FilterFieldType) => ({ value: selected }: SelectableValue<string>) => {
    const fullFilter = type === FilterFieldType.FieldName
      ? `${selected}: ${fieldValue || ''}`
      : `${field || ''}: ${field === '_stream' ? selected : `"${escapeLabelValueInExactSelector(selected || "")}"`} `

    onChange({
      ...query,
      filters: updateValueByIndexPath(query.filters, indexPath, fullFilter)
    })
  }

  const handleCreate = (type: FilterFieldType) => (customValue: string) => {
    handleSelect(type)({ value: customValue })
  }

  const handleOpenMenu = (type: FilterFieldType) => async () => {
    const setterLoading = type === FilterFieldType.FieldName ? setIsLoadingFieldNames : setIsLoadingFieldValues
    const setterValues = type === FilterFieldType.FieldName ? setFieldNames : setFieldValues

    setterLoading(true)
    const limit = datasource.getQueryBuilderLimits(type)
    const filtersWithoutCurrent = deleteByIndexPath(query.filters, indexPath)
    const currentOperator = query.filters.operators[indexPath[0] - 1] || "AND"
    const filters = currentOperator === "AND" ? filterVisualQueryToString(filtersWithoutCurrent, true) : ""
    const list = await datasource.languageProvider?.getFieldList({ type, timeRange, field, limit, query: filters }, datasource.customQueryParameters);
    const result = list ? list.map(({ value, hits }) => ({
      value,
      label: value || " ",
      description: `hits: ${hits}`,
    })) : []
    setterValues(result)
    setterLoading(false)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Label>Filter</Label>
        <IconButton
          name={"times"}
          tooltip={"Remove filter"}
          size="sm"
          onClick={handleRemoveFilter}
        />
      </div>
      <div className={styles.content}>
        <Select
          placeholder="Select field name"
          width="auto"
          options={fieldNames.length ? fieldNames : [{ label: field, value: field }]}
          value={field}
          isLoading={isLoadingFieldNames}
          loadingMessage={"Loading fields names..."}
          allowCustomValue
          onCreateOption={handleCreate(FilterFieldType.FieldName)}
          onChange={handleSelect(FilterFieldType.FieldName)}
          onOpenMenu={handleOpenMenu(FilterFieldType.FieldName)}
        />
        <span>:</span>
        <Select
          placeholder="Select field value"
          width="auto"
          options={fieldValues.length ? fieldValues : fieldValue ? [{ label: fieldValue, value: fieldValue }] : []}
          value={fieldValue}
          isLoading={isLoadingFieldValues}
          loadingMessage={"Loading fields values..."}
          noOptionsMessage={field ? "No values found" : "Select field name first"}
          allowCustomValue
          onCreateOption={handleCreate(FilterFieldType.FieldValue)}
          onChange={handleSelect(FilterFieldType.FieldValue)}
          onOpenMenu={handleOpenMenu(FilterFieldType.FieldValue)}
        />
      </div>
    </div>
  )
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: grid;
      gap: ${theme.spacing(0.5)};
      width: max-content;
      border: 1px solid ${theme.colors.border.strong};
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1)};
    `,
    header: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
    `,
    content: css`
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${theme.spacing(0.5)};
    `,
  };
};

export default QueryBuilderFieldFilter
