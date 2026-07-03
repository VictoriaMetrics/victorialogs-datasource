import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { Hint } from './keyboardHints';

interface Props {
  hints: Hint[];
}

/**
 * Key of a hint. If multiple keys are provided, they are joined with a '+'
 */
const Key = ({ keys, className }: {keys: Hint['keys'], className?: string}) => {
  return <Stack direction='row' gap={0.5} alignItems='center'>
    {keys.map((key, index) => (
      <React.Fragment key={key}>
        {index > 0 && (
          <Text color='secondary' variant='bodySmall'>
            +
          </Text>
        )}
        <span className={className}>{key}</span>
      </React.Fragment>
    ))}
  </Stack>;
};

/**
 * A footer of context-aware keyboard hints, pinned to the bottom of an open dropdown
 */
export const KeyboardHintsBar: React.FC<Props> = ({ hints }) => {
  const styles = useStyles2(getStyles);

  if (hints.length === 0) {
    return null;
  }

  return (
    <div className={styles.bar}>
      {hints.map((hint, hintIndex) => (
        <React.Fragment key={hint.label}>
          {hintIndex > 0 && <span className={styles.separator} aria-hidden='true' />}
          <Stack direction='row' gap={0.5} alignItems='center'>
            <Key keys={hint.keys} className={styles.key} />
            <Text color='secondary' variant='bodySmall'>
              {hint.label}
            </Text>
          </Stack>
        </React.Fragment>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5, 1),
    padding: theme.spacing(0.5, 1),
    backgroundColor: theme.colors.background.secondary,
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  separator: css({
    flex: 'none',
    width: 1,
    height: 12,
    backgroundColor: theme.colors.border.medium,
  }),
  key: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0, 0.25),
    color: theme.colors.text.secondary,
    backgroundColor: theme.colors.background.primary,
  }),
});
