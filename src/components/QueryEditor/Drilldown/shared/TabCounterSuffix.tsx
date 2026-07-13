import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { formatHits } from '../../shared/formatHits';

/**
 * Builds a Tab suffix rendering the count in the same compact form as the charts
 * (formatHits, e.g. 12.3 K) — the Tab's own `counter` prop always renders the full
 * locale number. Styled after @grafana/ui's Counter badge
 */
export const makeCounterSuffix = (value: number): React.ComponentType<{ className?: string }> | undefined => {
  if (!value) {
    return undefined;
  }
  const CounterSuffix: React.FC<{ className?: string }> = ({ className }) => {
    const styles = useStyles2(getCounterStyles);
    return <span className={cx(className, styles.counter)}>{formatHits(value)}</span>;
  };
  return CounterSuffix;
};

const getCounterStyles = (theme: GrafanaTheme2) => ({
  counter: css({
    marginLeft: theme.spacing(1),
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.secondary.main,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.size.sm,
  }),
});
