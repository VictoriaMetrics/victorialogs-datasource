import React, { memo, useCallback, useMemo } from 'react';

import { TimeRange } from '@grafana/data';
import { Label, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';
import OptionalField from '../shared/OptionalField';
import { getSharedStyles } from '../shared/styles';
import { useFieldFetch } from '../shared/useFieldFetch';
import { useQueryContexts } from '../shared/useQueryContexts';
import { useRowManagement } from '../shared/useRowManagement';
import { AggregateStep, PipelineStepItem, PipelineStepPatch } from '../types';

import AggregateRowContainer from './AggregateRowContainer';
import { AggregateRow } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  onDeleteStep: (id: string) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const AggregateStepContent = memo(function AggregateStepContent({
  step,
  datasource,
  timeRange,
  onStepChange,
  onDeleteStep,
  steps,
  stepIndex,
}: Props) {
  const styles = useStyles2(getSharedStyles);
  const aggregateStep = step as AggregateStep;
  const rows = aggregateStep.rows ?? [];
  const queryContexts = useQueryContexts(steps, stepIndex, Math.max(rows.length, 1));
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext: queryContexts[0] });

  const { handleRowChange, handleRowDelete } = useRowManagement<AggregateRow>({
    rows,
    stepId: step.id,
    onStepChange,
    onDeleteStep,
  });

  const selectedByFields = useMemo(
    () => (aggregateStep.byFields ?? []).map((f) => ({ label: f, value: f })),
    [aggregateStep.byFields]
  );

  const handleByFieldsChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onStepChange(step.id, {
        byFields: selected.map((s) => s.value ?? '').filter(Boolean),
      });
    },
    [onStepChange, step.id]
  );

  const isByFieldsActive = aggregateStep.byFields !== undefined;

  const handleAddByFields = useCallback(
    () => onStepChange(step.id, { byFields: [] }),
    [onStepChange, step.id]
  );

  const handleRemoveByFields = useCallback(
    () => onStepChange(step.id, { byFields: undefined }),
    [onStepChange, step.id]
  );

  return (
    <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
      {rows.map((row, index) => (
        <React.Fragment key={row.id}>
          {index > 0 && <span className={styles.separator} />}
          <AggregateRowContainer
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
    </Stack>
  );
});

export default AggregateStepContent;
