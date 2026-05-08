import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';

import { CoreApp, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../datasource';
import { addLabelToQuery } from '../../modifyQuery';
import { Query } from '../../types';
import {
  appendFilterPipeToQuery,
  formatAdHocFilterLabel,
  queryHasPipes,
} from '../../utils/query/adHocFilters';

import { useAdHocFilterValidation } from './useAdHocFilterValidation';

interface AdHocFiltersControlProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  timeRange?: TimeRange;
  app?: CoreApp;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
}

const buildInvalidFieldTooltip = (key: string): string =>
  `Field "${key}" is produced by the query (e.g. by extract, unpack or another pipe) and doesn't exist in the source data.
   The ad-hoc filter is applied at the source level,
    so it will filter out the rows needed to produce this field — your results will be empty or incorrect.
   To fix this, use the "Move to query" button — it will append this filter as a post-filter pipe (\`| filter ...\`) at the end of the query,
    so it runs after the pipes that produce the field.
   You can also add the filter manually at the appropriate position in the query expression.`;

export const AdHocFiltersControl: React.FC<AdHocFiltersControlProps> = ({
  datasource,
  query,
  timeRange,
  app,
  onChange,
  onRunQuery,
}) => {
  const styles = useStyles2(getStyles);

  const filters = useMemo(() => query.adHocFilters ?? [], [query.adHocFilters]);

  const fieldNames = useMemo(() => Array.from(new Set(filters.map((f) => f.key))), [filters]);
  const validation = useAdHocFilterValidation({ datasource, query, timeRange, fieldNames });

  const handleDeleteFilter = (index: number) => {
    const next = filters.filter((_, i) => i !== index);
    onChange({ ...query, adHocFilters: next.length ? next : undefined });
    onRunQuery();
  };

  const handleMoveToQuery = (index: number) => {
    const filter = filters[index];
    if (!filter) {
      return;
    }
    const currentExpr = query.expr?.trim() || '*';
    const isInvalid = validation[filter.key] === 'invalid';
    const filterStr = formatAdHocFilterLabel(filter);
    const newExpr = isInvalid
      ? appendFilterPipeToQuery(currentExpr, filter)
      : currentExpr === '*'
        ? filterStr
        : addLabelToQuery(currentExpr, filter);
    const next = filters.filter((_, i) => i !== index);
    onChange({
      ...query,
      expr: newExpr,
      adHocFilters: next.length ? next : undefined,
    });
    onRunQuery();
  };

  if (app !== CoreApp.Explore || filters.length === 0) {
    return null;
  }

  return (
    <div className={styles.adHocFiltersContainer}>
      <div className={styles.adHocFiltersLabel}>
        <Icon name='filter' size='sm' />
        <span>Ad-hoc filters:</span>
      </div>
      {filters.map((filter, index) => {
        const isInvalid = validation[filter.key] === 'invalid';
        const willAppendAsPipe = isInvalid && queryHasPipes(query.expr ?? '');
        const moveTooltip = willAppendAsPipe ? (
          <>
            Append as a post-filter pipe at the end of the query:
            <br />
            <code>| filter {formatAdHocFilterLabel(filter)}</code>
          </>
        ) : (
          'Move to query'
        );
        const chip = (
          <div className={cx(styles.adHocFilterItem, isInvalid && styles.adHocFilterItemInvalid)}>
            {isInvalid && (
              <Icon name='exclamation-triangle' className={styles.warningIcon} size='sm' />
            )}
            <span className={styles.filterText}>{formatAdHocFilterLabel(filter)}</span>
            <div className={styles.filterActions}>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => handleMoveToQuery(index)}
                tooltip={moveTooltip}
                fill='text'
              >
                <Icon name='arrow-up' />
              </Button>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => handleDeleteFilter(index)}
                tooltip='Delete filter'
                fill='text'
              >
                <Icon name='times' />
              </Button>
            </div>
          </div>
        );

        return isInvalid ? (
          <Tooltip key={index} content={buildInvalidFieldTooltip(filter.key)} placement='top'>
            {chip}
          </Tooltip>
        ) : (
          <React.Fragment key={index}>{chip}</React.Fragment>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    adHocFiltersContainer: css`
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.spacing(1)};
      width: fit-content;
      margin-top: ${theme.spacing(1)};
      padding: ${theme.spacing(1)};
      background-color: ${theme.colors.background.secondary};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.radius.default};
    `,
    adHocFiltersLabel: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(0.5)};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.secondary};
      white-space: nowrap;
    `,
    adHocFilterItem: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(0.5)};
      padding: ${theme.spacing(0.25, 0.25, 0.25, 1)};
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.bodySmall.fontSize};

      &:hover {
        border-color: ${theme.colors.border.medium};
      }
    `,
    adHocFilterItemInvalid: css`
      border-color: ${theme.colors.warning.border};
      background-color: ${theme.colors.warning.transparent};

      &:hover {
        border-color: ${theme.colors.warning.text};
      }
    `,
    warningIcon: css`
      color: ${theme.colors.warning.text};
    `,
    filterText: css`
      color: ${theme.colors.text.primary};
      white-space: nowrap;
      margin-right: ${theme.spacing(0.5)};
    `,
    filterActions: css`
      display: flex;
      align-items: center;
      padding-left: ${theme.spacing(0.25)};
      border-left: 1px solid ${theme.colors.border.weak};

      button {
        padding: 0 ${theme.spacing(0.25)};
        color: ${theme.colors.text.secondary};

        &:hover {
          color: ${theme.colors.text.primary};
        }
      }
    `,
  };
};
