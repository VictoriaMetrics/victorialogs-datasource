import { css } from "@emotion/css";
import React from 'react';

import { GrafanaTheme2 } from "@grafana/data";
import { Badge, useTheme2 } from "@grafana/ui";


interface Props {
  regExp: string;
}

const QueryEditorVariableRegexpError = ({ regExp }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const text = (
    <div>
      Regexp operator (~) cannot be used with variables in {regExp}. Use exact match operator (:) or use non variable in regexp instead.
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
