import React, { useCallback, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { Button } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';
import { PatternFilter } from '../patterns/patternFilters';

import { FilterChipEditor } from './FilterChipEditor';

interface AddFilterControlProps {
  datasource: VictoriaLogsDatasource;
  /** Narrows the field and value lookups */
  existingFilters: AdHocFilter[];
  /** Narrow the lookups the way they narrow every data query */
  patternFilters?: PatternFilter[];
  timeRange: TimeRange;
  onAdd: (filter: AdHocFilter) => void;
}

/**
 * The "+ Filter" button. A click replaces it with an inline FilterChipEditor that composes a
 * new `field [operator] value` filter, and a commit or a cancel brings the button back
 */
export const AddFilterControl: React.FC<AddFilterControlProps> = ({
  datasource,
  existingFilters,
  patternFilters = [],
  timeRange,
  onAdd,
}) => {
  const [editing, setEditing] = useState(false);

  const handleCommit = useCallback(
    (filter: AdHocFilter) => {
      onAdd(filter);
      setEditing(false);
    },
    [onAdd]
  );

  const handleCancel = useCallback(() => setEditing(false), []);

  if (!editing) {
    return (
      <Button icon='plus' size='sm' variant='secondary' onClick={() => setEditing(true)}>
        Filter
      </Button>
    );
  }

  return (
    <FilterChipEditor
      datasource={datasource}
      existingFilters={existingFilters}
      patternFilters={patternFilters}
      timeRange={timeRange}
      onCommit={handleCommit}
      onCancel={handleCancel}
    />
  );
};
