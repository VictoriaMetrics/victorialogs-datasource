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
  /** When set, and the filter is editable, each segment becomes a button that starts editing it */
  onEditSegment?: (segment: FilterSegment) => void;
}

/**
 * Static `field | operator | value` chip for one ad-hoc filter. An editable filter renders its
 * segments as buttons that hand the clicked one to the in-place editor. Multi-value and other
 * non-editable chips stay read-only
 */
export const FilterChip: React.FC<FilterChipProps> = ({ filter, onRemove, onEditSegment }) => {
  const styles = useStyles2(getChipSegmentStyles);

  const filterLabel = formatAdHocFilterLabel(filter);
  // a multi-value filter shows every value, and an empty value must not collapse the segment
  const displayValue = filter.values?.length ? filter.values.map((v) => (v === '' ? '""' : v)).join(', ') : filter.value || '""';
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
