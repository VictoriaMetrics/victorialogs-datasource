import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';
import { isLevelChip } from '../../../../utils/query/levelChips';
import { SegmentedChip } from '../../../shared/Chip/SegmentedChip';
import { PatternFilter } from '../patterns/patternFilters';

import { AddFilterControl } from './AddFilterControl';
import { FilterChip } from './FilterChip';
import { FilterChipEditor, FilterSegment } from './FilterChipEditor';
import { getChipSegmentStyles } from './chipSegmentStyles';

interface EditingState {
  index: number;
  segment: FilterSegment;
}

interface DrilldownFiltersRowProps {
  datasource: VictoriaLogsDatasource;
  filters: AdHocFilter[];
  onFiltersChange: (filters: AdHocFilter[]) => void;
  patternFilters?: PatternFilter[];
  onPatternFiltersChange?: (filters: PatternFilter[]) => void;
  onApply: () => void;
  timeRange: TimeRange;
  zoomToolbar?: React.ReactNode;
  onAdd: (filter: AdHocFilter) => void;
}

/** The drawer's filter row: the ad-hoc chips, which are editable in place, the zoom toolbar and the go-to-editor button */
export const DrilldownFiltersRow: React.FC<DrilldownFiltersRowProps> = ({
  datasource,
  filters,
  onFiltersChange,
  patternFilters = [],
  onPatternFiltersChange,
  onApply,
  timeRange,
  zoomToolbar,
  onAdd,
}) => {
  const styles = useStyles2(getStyles);
  const segmentStyles = useStyles2(getChipSegmentStyles);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const handleRemove = useCallback(
    (index: number) => {
      onFiltersChange(filters.filter((_, i) => i !== index));
      setEditing((prev) => {
        if (!prev || prev.index < index) {
          return prev;
        }
        return prev.index === index ? null : { ...prev, index: prev.index - 1 };
      });
    },
    [filters, onFiltersChange]
  );

  const handleEditCommit = useCallback(
    (index: number, updated: AdHocFilter) => {
      onFiltersChange(filters.map((f, i) => (i === index ? updated : f)));
      setEditing(null);
    },
    [filters, onFiltersChange]
  );

  const stopEditing = useCallback(() => setEditing(null), []);

  return (
    <Stack direction='row' gap={1} alignItems='flex-start'>
      <div className={styles.filters}>
        <Stack direction='row' gap={1} wrap alignItems='center'>
          {filters.map((filter, index) => {
            if (isLevelChip(filter)) {
              return null;
            }
            if (editing?.index === index) {
              return (
                <FilterChipEditor
                  key={`edit-${filter.key}-${filter.value}-${index}`}
                  datasource={datasource}
                  existingFilters={filters.filter((f) => f !== filter)}
                  patternFilters={patternFilters}
                  timeRange={timeRange}
                  initialFilter={filter}
                  initialSegment={editing.segment}
                  onCommit={(updated) => handleEditCommit(index, updated)}
                  onCancel={stopEditing}
                />
              );
            }
            return (
              <FilterChip
                key={`${filter.key}-${filter.value}-${index}`}
                filter={filter}
                onRemove={() => handleRemove(index)}
                onEditSegment={(segment) => setEditing({ index, segment })}
              />
            );
          })}
          {patternFilters.map((filter) => {
            const filterLabel = `${filter.type === 'include' ? '≈' : '!≈'} ${filter.pattern}`;
            return (
              <SegmentedChip
                key={`pattern-${filter.type}-${filter.pattern}`}
                title={filterLabel}
                onRemove={() => onPatternFiltersChange?.(patternFilters.filter((f) => f.pattern !== filter.pattern))}
                removeAriaLabel={`Remove pattern filter ${filter.pattern}`}
              >
                <span className={segmentStyles.segmentSecondary}>{filter.type === 'include' ? '≈' : '!≈'}</span>
                <span className={segmentStyles.segmentValue}>
                  <span className={segmentStyles.segmentText}>{filter.pattern}</span>
                </span>
              </SegmentedChip>
            );
          })}
          <AddFilterControl
            datasource={datasource}
            existingFilters={filters}
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

const getStyles = () => ({
  filters: css({
    flex: 1,
    minWidth: 0,
  }),
});
