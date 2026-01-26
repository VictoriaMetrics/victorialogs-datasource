import { css } from "@emotion/css";
import React, { useCallback } from 'react';

import { GrafanaTheme2 } from "@grafana/data";
import { Badge, TextLink, useStyles2 } from "@grafana/ui";

import { replaceRegExpOperatorToOperator } from "../../LogsQL/regExpOperator";
import { Query } from "../../types";

interface Props {
  regExp: string;
  query: Query;
  onChange: (query: Query) => void;
}

const QueryEditorVariableRegexpError = ({ regExp, query, onChange }: Props) => {
  const styles = useStyles2(getStyles);
  const fixedFilter = replaceRegExpOperatorToOperator(regExp);
  const onApply = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const queryExpr = replaceRegExpOperatorToOperator(query.expr);
    onChange({ ...query, expr: queryExpr });
  }, [onChange, query])

  const text = (
    <div>
      Regexp operator `~` cannot be used with variables in `{regExp}`. Use word filter operator `:` (e.g. `{fixedFilter}`)
      or use non variable in regexp instead. <TextLink onClick={onApply} href={""}>Apply fix</TextLink>
    </div>
  )

  return (
    <div className={styles.root}>
      <Badge
        icon={"exclamation-triangle"}
        color={"red"}
        text={text}
      />
    </div>
  )
}

export default QueryEditorVariableRegexpError;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    root: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexGrow: 1,
    }),
  };
};
