import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface EditorRowProps {
  children: React.ReactNode;
}

export const EditorRow: React.FC<EditorRowProps> = ({ children }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.root}>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    root: css({
      marginTop: theme.spacing(0.5),
      padding: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    })
  };
};
