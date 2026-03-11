import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Dropdown, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { createFilterRow, FilterRow, FilterType, PipelineStepItem } from '../types';

import FilterRowContainer from './FilterRowContainer';
import { FILTER_TYPE_ENTRIES } from './filterTypeConfig';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: Partial<Omit<PipelineStepItem, 'id' | 'type'>>) => void;
}

const FilterStepContent = memo<Props>(({ step, datasource, timeRange, onStepChange }) => {
  const styles = useStyles2(getStyles);
  const rows = step.filterRows ?? [];

  const handleRowChange = useCallback(
    (updatedRow: FilterRow) => {
      const newRows = rows.map((r) => (r.id === updatedRow.id ? updatedRow : r));
      onStepChange(step.id, { filterRows: newRows });
    },
    [rows, onStepChange, step.id]
  );

  const handleRowDelete = useCallback(
    (rowId: string) => {
      if (rows.length <= 1) {
        return;
      }
      const newRows = rows.filter((r) => r.id !== rowId);
      onStepChange(step.id, { filterRows: newRows });
    },
    [rows, onStepChange, step.id]
  );

  const handleAddRow = useCallback(
    (filterType: FilterType, defaultOperator: string) => {
      onStepChange(step.id, { filterRows: [...rows, createFilterRow(filterType, defaultOperator)] });
    },
    [rows, onStepChange, step.id]
  );

  const menu = (
    <Menu>
      {FILTER_TYPE_ENTRIES.map((entry) => (
        <Menu.Item
          key={entry.filterType}
          label={entry.label}
          onClick={() => handleAddRow(entry.filterType, entry.defaultOperator)}
        />
      ))}
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
            canDelete={rows.length > 1}
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
