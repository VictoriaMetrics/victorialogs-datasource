import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { CoreApp, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Icon, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../datasource';
import { addLabelToQuery } from '../../modifyQuery';
import { AdHocFilter, Query, QueryEditorMode } from '../../types';
import {
  adHocFilterValues,
  appendFilterPipeToQuery,
  formatAdHocFilterLabel,
  formatChipOperatorLabel,
  queryHasPipes,
} from '../../utils/query/adHocFilters';
import { GroupedChip } from '../shared/Chip/GroupedChip';

import { buildPipeForAdHocFilter, withPipeInserted } from './TemplateBuilder/moveToQuery';
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

  const commitFilters = (next: AdHocFilter[]) => {
    onChange({ ...query, adHocFilters: next.length ? next : undefined });
    onRunQuery();
  };

  const handleDeleteFilter = (index: number) => {
    commitFilters(filters.filter((_, i) => i !== index));
  };

  const handleRemoveValue = (index: number, value: string) => {
    const filter = filters[index];
    if (!filter) {
      return;
    }
    const values = adHocFilterValues(filter).filter((v) => v !== value);
    if (values.length === 0) {
      handleDeleteFilter(index);
      return;
    }
    // Keep `value` in sync with the remaining list — consumers like
    // queryHasFilter fall back to it for single-value chips
    commitFilters(filters.map((f, i) => (i === index ? { ...f, value: values[0], values } : f)));
  };

  const handleMoveToQuery = (index: number) => {
    const filter = filters[index];
    if (!filter) {
      return;
    }
    const isInvalid = validation[filter.key] === 'invalid';
    const next = filters.filter((_, i) => i !== index);
    const nextAdHocFilters = next.length ? next : undefined;

    // In builder mode the expression is regenerated from the builder model, so
    // the filter must become a pipe of the model — editing expr alone would be
    // silently lost on the next builder interaction
    if (query.editorMode === QueryEditorMode.Builder) {
      const placement = buildPipeForAdHocFilter(filter, isInvalid);
      if (!placement) {
        return;
      }
      onChange({ ...query, ...withPipeInserted(query, placement.pipe, placement.position), adHocFilters: nextAdHocFilters });
      onRunQuery();
      return;
    }

    const currentExpr = query.expr?.trim() || '*';
    const filterStr = formatAdHocFilterLabel(filter);
    const newExpr = isInvalid
      ? appendFilterPipeToQuery(currentExpr, filter)
      : currentExpr === '*'
        ? filterStr
        : addLabelToQuery(currentExpr, filter);
    onChange({
      ...query,
      expr: newExpr,
      adHocFilters: nextAdHocFilters,
    });
    onRunQuery();
  };

  if (app !== CoreApp.Explore || filters.length === 0) {
    return null;
  }

  return (
    <Stack wrap='wrap' gap={0.5}>
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
          <GroupedChip
            label={formatChipOperatorLabel(filter)}
            values={adHocFilterValues(filter)}
            onRemoveValue={(value) => handleRemoveValue(index, value)}
            onRemoveAll={() => handleDeleteFilter(index)}
            title={formatAdHocFilterLabel(filter)}
            removeAllTooltip='Delete filter'
            removeAllAriaLabel={`Delete filter ${filter.key}`}
            className={isInvalid ? styles.invalidChip : undefined}
            leading={
              isInvalid ? (
                <Icon name='exclamation-triangle' className={styles.warningIcon} size='sm' />
              ) : undefined
            }
            actions={
              !filter.fromLevelFilter
                ? [
                  {
                    icon: 'arrow-down',
                    onClick: () => handleMoveToQuery(index),
                    ariaLabel: 'Move to query',
                    tooltip: moveTooltip,
                  },
                ]
                : undefined
            }
          />
        );

        return isInvalid ? (
          <Tooltip key={index} content={buildInvalidFieldTooltip(filter.key)} placement='top'>
            <div>{chip}</div>
          </Tooltip>
        ) : (
          <React.Fragment key={index}>{chip}</React.Fragment>
        );
      })}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    invalidChip: css({
      borderColor: theme.colors.warning.border,
      background: theme.colors.warning.transparent,

      '&:hover': {
        borderColor: theme.colors.warning.text,
      },
    }),
    warningIcon: css({
      color: theme.colors.warning.text,
    }),
  };
};
