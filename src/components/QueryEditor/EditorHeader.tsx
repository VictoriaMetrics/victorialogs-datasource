import { css } from "@emotion/css";
import React from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { useStyles2 } from "@grafana/ui";

interface EditorHeaderProps {
  children: React.ReactNode;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({ children }) => {
  const styles = useStyles2(getStyles);

  return <div className={styles.root}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    minHeight: theme.spacing(4),
  }),
});
