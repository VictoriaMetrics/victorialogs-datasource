import { css } from "@emotion/css";
import React, { useMemo } from "react";

import { GrafanaTheme2, SelectableValue } from "@grafana/data";
import { IconButton, Label, Select, useStyles2 } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../../../../datasource";
import { VisualQuery } from "../../../../../types";
import { deleteByIndexPath } from "../../utils/modifyFilterVisualQuery/deleteByIndexPath";
import { updateValueByIndexPath } from "../../utils/modifyFilterVisualQuery/updateByIndexPath";
import { DEFAULT_FILTER_KEY } from "../../utils/parseToString";

interface Props {
  datasource: VictoriaLogsDatasource;
  filter: string;
  query: VisualQuery;
  indexPath: number[];
  onChange: (query: VisualQuery) => void;
}

enum FilterType {
  Field = 'field',
  Value = 'value'
}

const QueryBuilderFieldFilter = ({ datasource, filter, query, indexPath, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  // const [fieldNames, setFieldNames] = useState<string[]>([])
  // const [isLoadingFieldNames, setIsLoadingFieldNames] = useState(false)
  //
  // const [fieldValues, setFieldValues] = useState<string[]>([])
  // const [isLoadingFieldValues, setIsLoadingFieldValues] = useState(false)

  const { filterField, filterValue } = useMemo(() => {
    const regex = /("[^"]*"|'[^']*'|\S+)\s*:\s*("[^"]*"|'[^']*'|\S+)?|\S+/i
    const matches = filter.match(regex);
    if (!matches || matches.length < 1) {
      return {};
    }
    const filterField = matches[1] || DEFAULT_FILTER_KEY
    const filterValue = matches[2] || matches[0]

    return { filterField, filterValue }
  }, [filter])

  const handleRemoveFilter = () => {
    onChange({
      ...query,
      filters: deleteByIndexPath(query.filters, indexPath)
    })
  }

  const handleSelect = (type: FilterType) => ({ value: selected }: SelectableValue<string>) => {
    const fullFilter = type === FilterType.Field
      ? `${selected}: ${filterValue || ''}`
      : `${filterField || ''}: ${selected}`

    onChange({
      ...query,
      filters: updateValueByIndexPath(query.filters, indexPath, fullFilter)
    })
  }

  const handleCreate = (type: FilterType) => (customValue: string) => {
    handleSelect(type)({ value: customValue })
  }

  const handleOpenMenu = (type: FilterType) => async () => {
    if (type === FilterType.Field) {
      console.log('fetch fields')
      // setIsLoadingFieldNames(true)
      const res = await datasource.languageProvider?.getFieldNames()
      console.log(res)
    } else {
      console.log('fetch values')
      // setIsLoadingFieldValues(true)
      const res = await datasource.languageProvider?.getFieldValues()
      console.log(res)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Label>Filter {indexPath.join(',')}</Label>
        <IconButton
          name={"times"}
          tooltip={"Remove filter"}
          size="sm"
          onClick={handleRemoveFilter}
        />
      </div>
      <div className={styles.content}>
        <Select
          placeholder="Select field"
          width="auto"
          options={[{ label: filterField, value: filterField }]}
          value={filterField}
          allowCustomValue
          onCreateOption={handleCreate(FilterType.Field)}
          onChange={handleSelect(FilterType.Field)}
          onOpenMenu={handleOpenMenu(FilterType.Field)}
        />
        <span>:</span>
        <Select
          placeholder="Select value"
          width="auto"
          options={[{ label: filterValue, value: filterValue }]}
          value={filterValue}
          allowCustomValue
          onCreateOption={handleCreate(FilterType.Value)}
          onChange={handleSelect(FilterType.Value)}
          onOpenMenu={handleOpenMenu(FilterType.Value)}
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
