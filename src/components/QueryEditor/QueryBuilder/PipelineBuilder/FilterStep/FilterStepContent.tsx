import React, { memo, useCallback } from 'react';

import { TimeRange } from '@grafana/data';
import { Button, Dropdown, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { getSharedStyles } from '../shared/styles';
import { useQueryContexts } from '../shared/useQueryContexts';
import { useRowManagement } from '../shared/useRowManagement';
import { FilterStep, PipelineStepItem, PipelineStepPatch } from '../types';

import FilterRowContainer from './FilterRowContainer';
import FILTER_TYPE_CONFIG, { FILTER_TYPE_FLAT_ENTRIES } from './filterTypeConfig';
import { createFilterRow, FILTER_TYPE, FilterRow, FilterType } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const FilterStepContent = memo<Props>(({ step, datasource, timeRange, onStepChange, steps, stepIndex }) => {
  const styles = useStyles2(getSharedStyles);
  const rows = (step as FilterStep).rows ?? [];

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<FilterRow>({
    rows,
    stepId: step.id,
    onStepChange,
  });

  const queryContexts = useQueryContexts(steps, stepIndex, rows.length);

  const onAddFilter = useCallback(
    (filterType: FilterType) => {
      const config = FILTER_TYPE_CONFIG[filterType];
      handleAddRow(createFilterRow(filterType, config.defaultOperator));
    },
    [handleAddRow]
  );

  const menu = (
    <Menu>
      {FILTER_TYPE_FLAT_ENTRIES.map(({ filterType, label, description }) => (
        <Menu.Item
          key={filterType}
          label={label}
          description={description}
          onClick={() => onAddFilter(filterType)}
        />
      ))}
      <Menu.Divider />
      <Menu.Item label='Custom' onClick={() => onAddFilter(FILTER_TYPE.CustomPipe)} />
    </Menu>
  );

  return (
    <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
      {rows.map((row, index) => (
        <React.Fragment key={row.id}>
          {index > 0 && <span className={styles.separator} />}
          <FilterRowContainer
            row={row}
            datasource={datasource}
            timeRange={timeRange}
            canDelete={true}
            onChange={handleRowChange}
            onDelete={() => handleRowDelete(row.id)}
            queryContext={queryContexts[index]}
          />
        </React.Fragment>
      ))}
      <Dropdown overlay={menu} placement='bottom-start'>
        <Button variant='secondary' icon='plus' size='sm'>
          Add filter
        </Button>
      </Dropdown>
    </Stack>
  );
});

FilterStepContent.displayName = 'FilterStepContent';

export default FilterStepContent;
