import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Dropdown, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { useRowManagement } from '../shared/useRowManagement';
import { FilterStep, PipelineStepItem, PipelineStepPatch } from '../types';

import FilterRowContainer from './FilterRowContainer';
import { FILTER_TYPE_ENTRIES } from './filterTypeConfig';
import { createFilterRow, FILTER_TYPE, FilterRow, FilterType } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
}

const FilterStepContent = memo<Props>(({ step, datasource, timeRange, onStepChange }) => {
  const styles = useStyles2(getStyles);
  const rows = (step as FilterStep).rows ?? [];

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<FilterRow>({
    rows,
    stepId: step.id,
    onStepChange,
  });

  const onAddFilter = useCallback(
    (filterType: FilterType) => {
      handleAddRow(createFilterRow(filterType));
    },
    [handleAddRow]
  );

  const menu = (
    <Menu>
      {FILTER_TYPE_ENTRIES.map((entry) => (
        <Menu.Item
          key={entry.filterType}
          label={entry.label}
          onClick={() => onAddFilter(entry.filterType)}
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
          />
        </React.Fragment>
      ))}
      <Dropdown overlay={menu}>
        <Button variant='secondary' icon='plus' size='sm'>
          Add filter
        </Button>
      </Dropdown>
    </Stack>
  );
});

FilterStepContent.displayName = 'FilterStepContent';

export default FilterStepContent;

const getStyles = (theme: GrafanaTheme2) => ({
  separator: css`
    display: inline-block;
    width: 2px;
    height: ${theme.spacing(4)};
    background-color: ${theme.colors.border.strong};
    margin: 0 ${theme.spacing(0.5)};
    flex-shrink: 0;
  `,
});
