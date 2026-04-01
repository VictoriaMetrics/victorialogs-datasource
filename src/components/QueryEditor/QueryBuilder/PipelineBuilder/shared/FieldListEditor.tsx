import React, { memo, useCallback, useMemo } from 'react';

import { TimeRange } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { useTemplateVariables } from '../../../../../hooks/useTemplateVariables';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';

import IfFilterInput from './IfFilterInput';
import { useFieldFetch } from './useFieldFetch';

interface FieldListRow {
  fieldList?: string[];
  ifFilter?: string;
}

interface Props<TRow extends FieldListRow> {
  row: TRow;
  onChange: (updatedRow: TRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext?: string;
  showIfFilter?: boolean;
}

function FieldListEditorInner<TRow extends FieldListRow>({
  row,
  onChange,
  datasource,
  timeRange,
  queryContext,
  showIfFilter = false,
}: Props<TRow>) {
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext });
  const { filterSelection } = useTemplateVariables();

  const selectedFields = useMemo(
    () => (row.fieldList ?? []).map((f) => ({ label: f, value: f })),
    [row.fieldList]
  );

  const handleChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onChange({ ...row, fieldList: filterSelection(selected.map((s) => s.value ?? '').filter(Boolean)) });
    },
    [onChange, row, filterSelection]
  );

  const handleIfFilterChange = useCallback(
    (value: string | undefined) => onChange({ ...row, ifFilter: value }),
    [onChange, row]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      {showIfFilter && <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />}
      <CompatibleMultiCombobox
        placeholder='Select fields'
        value={selectedFields}
        options={loadFieldNames}
        onChange={handleChange}
        width='auto'
        minWidth={16}
        createCustomValue
      />
    </Stack>
  );
}

const FieldListEditor = memo(FieldListEditorInner) as typeof FieldListEditorInner;

export default FieldListEditor;
