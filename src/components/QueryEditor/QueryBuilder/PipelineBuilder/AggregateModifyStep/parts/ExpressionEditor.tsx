import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import { AggregateModifyRowContentProps } from '../aggregateModifyTypeConfig';

const ExpressionEditor = memo(function ExpressionEditor({ row, onChange }: AggregateModifyRowContentProps) {
  const styles = useStyles2(getStyles);

  const handleExpressionChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...row, expression: e.currentTarget.value });
    },
    [onChange, row]
  );

  const handleResultNameChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...row, resultName: e.currentTarget.value });
    },
    [onChange, row]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center'>
      <AutoSizeInput
        placeholder='expression'
        defaultValue={row.expression}
        minWidth={16}
        onCommitChange={handleExpressionChange}
      />
      <span className={styles.asLabel}>as</span>
      <AutoSizeInput
        placeholder='result name'
        defaultValue={row.resultName}
        minWidth={10}
        onCommitChange={handleResultNameChange}
      />
    </Stack>
  );
});

export default ExpressionEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  asLabel: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-style: italic;
    padding: 0 ${theme.spacing(0.25)};
  `,
});
