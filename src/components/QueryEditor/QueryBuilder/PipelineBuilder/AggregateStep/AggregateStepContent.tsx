import { css } from '@emotion/css';
import React, { memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Dropdown, Label, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';
import OptionalField from '../shared/OptionalField';
import { useFieldFetch } from '../shared/useFieldFetch';
import { useRowManagement } from '../shared/useRowManagement';
import { PipelineStepItem } from '../types';

import AggregateRowContainer from './AggregateRowContainer';
import { AGGREGATE_TYPE_GROUPED_ENTRIES } from './aggregateTypeConfig';
import { AggregateRow, AggregateType, createAggregateRow } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: Partial<Omit<PipelineStepItem, 'id' | 'type'>>) => void;
}

const AggregateStepContent = memo(function AggregateStepContent({
  step,
  datasource,
  timeRange,
  onStepChange,
}: Props) {
  const styles = useStyles2(getStyles);
  const rows = step.aggregateRows ?? [];
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange });

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<AggregateRow>({
    rows,
    stepId: step.id,
    rowsKey: 'aggregateRows',
    onStepChange,
  });

  const onAddAggregate = useCallback(
    (aggregateType: AggregateType) => {
      handleAddRow(createAggregateRow(aggregateType));
    },
    [handleAddRow]
  );

  const selectedByFields = useMemo(
    () => (step.aggregateByFields ?? []).map((f) => ({ label: f, value: f })),
    [step.aggregateByFields]
  );

  const handleByFieldsChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onStepChange(step.id, {
        aggregateByFields: selected.map((s) => s.value ?? '').filter(Boolean),
      });
    },
    [onStepChange, step.id]
  );

  const isByFieldsActive = step.aggregateByFields !== undefined;

  const handleAddByFields = useCallback(
    () => onStepChange(step.id, { aggregateByFields: [] }),
    [onStepChange, step.id]
  );

  const handleRemoveByFields = useCallback(
    () => onStepChange(step.id, { aggregateByFields: undefined }),
    [onStepChange, step.id]
  );

  const menu = (
    <Menu>
      {AGGREGATE_TYPE_GROUPED_ENTRIES.map(({ group, entries }) => (
        <Menu.Item
          key={group}
          label={group}
          childItems={entries.map(({ aggregateType, label, description }) => (
            <Menu.Item
              key={aggregateType}
              label={label}
              description={description}
              onClick={() => onAddAggregate(aggregateType)}
            />
          ))}
        />
      ))}
    </Menu>
  );

  return (
    <Stack direction='column' gap={1} alignItems='flex-start' wrap='wrap'>
      <OptionalField label='group by' isActive={isByFieldsActive} onAdd={handleAddByFields} onRemove={handleRemoveByFields}>
        <Stack alignItems='center'>
          <Label>group by</Label>
          <CompatibleMultiCombobox
            placeholder='Select fields'
            value={selectedByFields}
            options={loadFieldNames}
            onChange={handleByFieldsChange}
            width='auto'
            minWidth={15}
            createCustomValue
          />
        </Stack>
      </OptionalField>
      <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
        {rows.map((row, index) => (
          <React.Fragment key={row.id}>
            {index > 0 && <span className={styles.separator} />}
            <AggregateRowContainer
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
            Add aggregate
          </Button>
        </Dropdown>
      </Stack>
    </Stack>
  );
});

export default AggregateStepContent;

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
