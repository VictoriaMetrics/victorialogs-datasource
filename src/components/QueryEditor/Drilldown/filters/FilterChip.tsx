import { cx } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { AdHocFilter } from '../../../../types';
import { formatAdHocFilterLabel } from '../../../../utils/query/adHocFilters';
import { SegmentedChip } from '../../../shared/Chip/SegmentedChip';

import { FilterSegment, isEditableFilter } from './FilterChipEditor';
import { getChipSegmentStyles } from './chipSegmentStyles';

interface FilterChipProps {
  filter: AdHocFilter;
  onRemove: () => void;
  /** When set (and the filter is editable in place), the segments become clickable and start editing that segment */
  onEditSegment?: (segment: FilterSegment) => void;
}

/**
 * Static `field | operator | value` chip for one ad-hoc filter. Editable filters render
 * their segments as buttons that hand the clicked segment to the in-place editor;
 * multi-value and other non-editable chips keep plain read-only segments
 */
export const FilterChip: React.FC<FilterChipProps> = ({ filter, onRemove, onEditSegment }) => {
  const styles = useStyles2(getChipSegmentStyles);

  const filterLabel = formatAdHocFilterLabel(filter);
  // multi-value filters keep every value visible; an empty value must not collapse the segment
  const displayValue = filter.values?.length ? filter.values.join(', ') : filter.value || '""';
  const editable = Boolean(onEditSegment) && isEditableFilter(filter);

  return (
    <SegmentedChip title={filterLabel} onRemove={onRemove} removeAriaLabel={`Remove filter ${filterLabel}`}>
      {editable ? (
        <>
          <button
            type='button'
            className={cx(styles.segmentSecondary, styles.segmentButton)}
            onClick={() => onEditSegment?.('field')}
            aria-label={`Edit field of filter ${filterLabel}`}
          >
            {filter.key}
          </button>
          <button
            type='button'
            className={cx(styles.segmentSecondary, styles.segmentButton)}
            onClick={() => onEditSegment?.('operator')}
            aria-label={`Edit operator of filter ${filterLabel}`}
          >
            {filter.operator}
          </button>
          <button
            type='button'
            className={cx(styles.segmentValue, styles.segmentButton)}
            onClick={() => onEditSegment?.('value')}
            aria-label={`Edit value of filter ${filterLabel}`}
          >
            <span className={styles.segmentText}>{displayValue}</span>
          </button>
        </>
      ) : (
        <>
          <span className={styles.segmentSecondary}>{filter.key}</span>
          <span className={styles.segmentSecondary}>{filter.operator}</span>
          <span className={styles.segmentValue}>
            <span className={styles.segmentText}>{displayValue}</span>
          </span>
        </>
      )}
    </SegmentedChip>
  );
};
