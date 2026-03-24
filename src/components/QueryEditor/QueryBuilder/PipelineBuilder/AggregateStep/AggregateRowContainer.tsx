import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { AutoSizeInput, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { getSharedStyles } from '../shared/styles';

import AGGREGATE_TYPE_CONFIG from './aggregateTypeConfig';
import { AggregateRow } from './types';

interface Props {
  row: AggregateRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: AggregateRow) => void;
  onDelete: () => void;
  queryContext?: string;
}

const AggregateRowContainer = memo(function AggregateRowContainer({
  row,
  datasource,
  timeRange,
  canDelete,
  onChange,
  onDelete,
  queryContext,
}: Props) {
  const styles = useStyles2(getStyles);
  const shared = useStyles2(getSharedStyles);
  const config = AGGREGATE_TYPE_CONFIG[row.aggregateType];

  const handleResultNameChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...row, resultName: e.currentTarget.value });
    },
    [onChange, row]
  );

  const { ContentComponent } = config;

  const removeButton = (
    <div className={shared.removeButtonContainer}>
      <IconButton
        className={shared.removeButton}
        name='times'
        size='sm'
        tooltip={canDelete ? 'Remove function' : 'Cannot remove the function'}
        onClick={onDelete}
        disabled={!canDelete}
      />
    </div>
  );

  return (
    <Stack direction='row' gap={0} alignItems='center'>
      <div className={styles.rowBorder}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.typeLabel}>{config.label}</span>
          <ContentComponent row={row} onChange={onChange} datasource={datasource} timeRange={timeRange} queryContext={queryContext} />
          <span className={styles.asLabel}>as</span>
          <AutoSizeInput
            placeholder='result name'
            defaultValue={row.resultName}
            minWidth={10}
            onCommitChange={handleResultNameChange}
          />
        </Stack>
      </div>
      {removeButton}
    </Stack>
  );
});

export default AggregateRowContainer;

const getStyles = (theme: GrafanaTheme2) => ({
  typeLabel: css`
    font-weight: ${theme.typography.fontWeightMedium};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.primary};
    padding: 0 ${theme.spacing(0.5)};
    white-space: nowrap;
  `,
  asLabel: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-style: italic;
    padding: 0 ${theme.spacing(0.25)};
  `,
  rowBorder: css`
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 ${theme.spacing(0.5)};
    border: 1px solid ${theme.colors.border.medium};
    border-right: none;
    border-radius: ${theme.shape.radius.default} 0 0 ${theme.shape.radius.default};
  `,
  contentNoRightRadius: css`
    & :last-child {
      & * {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
    }
  `,
});
