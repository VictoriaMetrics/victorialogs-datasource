import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';
import { formatAdHocFilterLabel } from '../../../../utils/query/adHocFilters';
import { SegmentedChip } from '../../../shared/Chip/SegmentedChip';
import { PatternFilter } from '../patterns/patternFilters';

import { AddFilterControl } from './AddFilterControl';

interface DrilldownFiltersRowProps {
  datasource: VictoriaLogsDatasource;
  filters: AdHocFilter[];
  onFiltersChange: (filters: AdHocFilter[]) => void;
  patternFilters?: PatternFilter[];
  onPatternFiltersChange?: (filters: PatternFilter[]) => void;
  onApply: () => void;
  timeRange: TimeRange;
  zoomToolbar?: React.ReactNode;
  /** Editor filters plus drawer-local ones — narrows the "+ Filter" picker's value lookup */
  existingFilters: AdHocFilter[];
  onAdd: (filter: AdHocFilter) => void;
}

/** Filters row of the drawer: ad-hoc filter chips bound to the drawer's local filter list, plus a zoom toolbar and a go-to-editor action */
export const DrilldownFiltersRow: React.FC<DrilldownFiltersRowProps> = ({
  datasource,
  filters,
  onFiltersChange,
  patternFilters = [],
  onPatternFiltersChange,
  onApply,
  timeRange,
  zoomToolbar,
  existingFilters,
  onAdd,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction='row' gap={1} alignItems='flex-start'>
      <div className={styles.filters}>
        <Stack direction='row' gap={1} wrap alignItems='center'>
          {filters.map((filter, index) => {
            const filterLabel = formatAdHocFilterLabel(filter);
            // multi-value filters keep every value visible; an empty value must not collapse the segment
            const displayValue = filter.values?.length ? filter.values.join(', ') : filter.value || '""';
            return (
              <SegmentedChip
                key={`${filter.key}-${filter.value}-${index}`}
                title={filterLabel}
                onRemove={() => onFiltersChange(filters.filter((_, i) => i !== index))}
                removeAriaLabel={`Remove filter ${filterLabel}`}
              >
                <span className={styles.segmentSecondary}>{filter.key}</span>
                <span className={styles.segmentSecondary}>{filter.operator}</span>
                <span className={styles.segmentValue}>
                  <span className={styles.segmentText}>{displayValue}</span>
                </span>
              </SegmentedChip>
            );
          })}
          {patternFilters.map((filter) => {
            // ≈ marks an include-by-pattern, !≈ an exclude — these are pipe filters, not field=value ones
            const filterLabel = `${filter.type === 'include' ? '≈' : '!≈'} ${filter.pattern}`;
            return (
              <SegmentedChip
                key={`pattern-${filter.type}-${filter.pattern}`}
                title={filterLabel}
                onRemove={() => onPatternFiltersChange?.(patternFilters.filter((f) => f.pattern !== filter.pattern))}
                removeAriaLabel={`Remove pattern filter ${filter.pattern}`}
              >
                <span className={styles.segmentSecondary}>{filter.type === 'include' ? '≈' : '!≈'}</span>
                <span className={styles.segmentValue}>
                  <span className={styles.segmentText}>{filter.pattern}</span>
                </span>
              </SegmentedChip>
            );
          })}
          <AddFilterControl
            datasource={datasource}
            existingFilters={existingFilters}
            patternFilters={patternFilters}
            timeRange={timeRange}
            onAdd={onAdd}
          />
        </Stack>
      </div>
      <Stack direction='row' gap={1} alignItems='center'>
        {zoomToolbar}
        <Button size='sm' variant='primary' onClick={onApply}>
          Go to editor
        </Button>
      </Stack>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filters: css({
    flex: 1,
    minWidth: 0,
  }),
  segmentSecondary: css({
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    padding: theme.spacing(0, 1),
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  // the only shrinkable segment: shows the full value when it fits the row and
  // ellipsizes only when the chip runs out of horizontal space
  segmentValue: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    padding: theme.spacing(0, 1),
    color: theme.colors.text.primary,
  }),
  // ellipsis needs a text-level element — it does not apply to a flex container itself
  segmentText: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
