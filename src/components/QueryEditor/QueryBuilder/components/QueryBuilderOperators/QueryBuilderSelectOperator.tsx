import { css } from "@emotion/css";
import React from "react";

import { GrafanaTheme2, SelectableValue } from "@grafana/data";
import { Label, Select, useStyles2 } from "@grafana/ui";

import { VisualQuery } from "../../../../../types";
import { updateOperatorByIndexPath } from "../../utils/modifyFilterVisualQuery/updateByIndexPath";
import { DEFAULT_FILTER_OPERATOR } from "../../utils/parseToString";
import { BUILDER_OPERATORS } from "../../utils/parsing";

interface Props {
  query: VisualQuery;
  operator: string;
  indexPath: number[];
  onChange: (query: VisualQuery) => void;
}

const QueryBuilderSelectOperator: React.FC<Props> = ({ query, operator, indexPath, onChange }) => {
  const styles = useStyles2(getStyles);

  const handleOperatorChange = ({ value }: SelectableValue<string>) => {
    onChange({
      ...query,
      filters: updateOperatorByIndexPath(query.filters, indexPath, value || DEFAULT_FILTER_OPERATOR)
    });
  };

  const handleCreateOption = (customValue: string) => {
    handleOperatorChange({ value: customValue });
  };

  const options = BUILDER_OPERATORS.map((op) => ({ label: op, value: op }));

  return (
    <div className={styles.wrapper}>
      <Label>Operator</Label>
      <Select
        width="auto"
        options={options}
        value={operator.toUpperCase()}
        allowCustomValue
        onCreateOption={handleCreateOption}
        onChange={handleOperatorChange}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(0.5)};
      width: max-content;
      min-width: 100px;
      height: max-content;
      border: 1px solid ${theme.colors.border.medium};
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1)};
    `
  };
};

export default QueryBuilderSelectOperator;
