import React, { useCallback, useMemo, useRef, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';
import { isLevelChip } from '../../../../utils/query/levelChips';
import { SegmentedChip } from '../../../shared/Chip/SegmentedChip';
import { FieldLoadersProvider } from '../../TemplateBuilder/FieldLoadersContext';
import { PlaceholderChip } from '../../TemplateBuilder/PlaceholderChip';
import { PlaceholderSegment } from '../../TemplateBuilder/types';
import { useFieldFetch } from '../../shared/useFieldFetch';
import { PatternFilter } from '../patterns/patternFilters';
import { buildLookupQuery } from '../queries/drilldownQueries';

export type EditableFilterOperator = '=' | '!=' | '=~' | '!~';

const EDITABLE_OPERATORS: EditableFilterOperator[] = ['=', '!=', '=~', '!~'];

const OPERATOR_OPTIONS: ComboboxOption[] = EDITABLE_OPERATORS.map((op) => ({ label: op, value: op }));

export type FilterSegment = 'field' | 'operator' | 'value';

const isEditableOperator = (value: string | null): value is EditableFilterOperator =>
  EDITABLE_OPERATORS.includes(value as EditableFilterOperator);

export const isEditableFilter = (f: AdHocFilter): boolean =>
  !isLevelChip(f) && !f.values?.length && isEditableOperator(f.operator);

interface FilterChipEditorProps {
  datasource: VictoriaLogsDatasource;
  /** Narrows the field and value lookups. It must not contain the filter being edited */
  existingFilters: AdHocFilter[];
  /** Narrow the lookups the way they narrow every data query */
  patternFilters?: PatternFilter[];
  timeRange: TimeRange;
  /** When set, the editor edits this filter in place. Otherwise it composes a new one */
  initialFilter?: AdHocFilter;
  /** The segment the user clicked, activated on mount. Defaults to the field */
  initialSegment?: FilterSegment;
  onCommit: (filter: AdHocFilter) => void;
  onCancel: () => void;
}

/** Inline `field [operator] value` chip editor in the query-builder style */
export const FilterChipEditor: React.FC<FilterChipEditorProps> = ({
  datasource,
  existingFilters,
  patternFilters = [],
  timeRange,
  initialFilter,
  initialSegment,
  onCommit,
  onCancel,
}) => {
  const isEdit = Boolean(initialFilter);
  const initialValue = initialFilter?.value ?? null;

  const [active, setActive] = useState<FilterSegment | null>(initialSegment ?? 'field');
  const [field, setField] = useState<string | null>(initialFilter?.key ?? null);
  const [operator, setOperator] = useState<EditableFilterOperator>(
    initialFilter && isEditableOperator(initialFilter.operator) ? initialFilter.operator : '='
  );
  // the refs mirror the picked values, because PlaceholderChip calls onValueChange and
  // onConfirm one after the other before the matching state updates land
  const fieldRef = useRef<string | null>(initialFilter?.key ?? null);
  const operatorRef = useRef<EditableFilterOperator>(
    initialFilter && isEditableOperator(initialFilter.operator) ? initialFilter.operator : '='
  );
  const pendingValueRef = useRef<string | null>(null);

  // the lookup drops the filters on the picked field, so the picker still offers the other
  // values of that field
  const queryContext = useMemo(
    () => buildLookupQuery(datasource, existingFilters, patternFilters, field ?? undefined),
    [datasource, existingFilters, patternFilters, field]
  );
  const { loadFieldNames, loadFieldValuesForField } = useFieldFetch({ datasource, timeRange, queryContext });
  const loaders = useMemo(
    () => ({ loadFieldNames, loadFieldValuesForField }),
    [loadFieldNames, loadFieldValuesForField]
  );

  const fieldSegment = useMemo<PlaceholderSegment>(
    () => ({
      type: 'placeholder',
      id: 'filter-editor-field',
      role: 'fieldName',
      value: field,
      displayHint: 'field_name',
      optionSource: 'fieldNames',
    }),
    [field]
  );

  const operatorSegment = useMemo<PlaceholderSegment>(
    () => ({
      type: 'placeholder',
      id: 'filter-editor-operator',
      role: 'operator',
      value: operator,
      displayHint: '=',
      optionSource: 'static',
      staticOptions: OPERATOR_OPTIONS,
    }),
    [operator]
  );

  const valueSegment = useMemo<PlaceholderSegment>(
    () => ({
      type: 'placeholder',
      id: 'filter-editor-value',
      role: 'fieldValue',
      value: initialValue,
      displayHint: 'value',
      optionSource: 'fieldValues',
      dependsOn: 'filter-editor-field',
    }),
    [initialValue]
  );

  const commit = useCallback(
    (value: string) => {
      // every commit path checks fieldRef first, so it is always set here
      onCommit({ key: fieldRef.current!, operator: operatorRef.current, value });
    },
    [onCommit]
  );

  const handleFieldChange = useCallback((value: string | null) => {
    fieldRef.current = value;
    setField(value);
  }, []);

  const handleFieldConfirm = useCallback(() => {
    if (!fieldRef.current) {
      // an empty confirm collapses a new draft back to the button, and in edit mode it leaves
      // the chip unchanged
      onCancel();
      return;
    }
    // composing moves on to the operator. Editing jumps straight to the value, because the
    // previous value rarely fits the new field
    setActive(isEdit ? 'value' : 'operator');
  }, [isEdit, onCancel]);

  const handleFieldDeactivate = useCallback(() => {
    // leaving the picker before choosing a field collapses the draft back to the button. In
    // edit mode, leaving any segment keeps the chip unchanged
    if (isEdit || !fieldRef.current) {
      onCancel();
      return;
    }
    setActive(null);
  }, [isEdit, onCancel]);

  const handleOperatorChange = useCallback((value: string | null) => {
    // typed text that is not a known operator leaves the current one in place
    if (isEditableOperator(value)) {
      operatorRef.current = value;
      setOperator(value);
    }
  }, []);

  const handleOperatorConfirm = useCallback(() => {
    // editing an existing chip commits the new operator at once and keeps the value.
    // Composing a new filter moves on to the value step
    if (isEdit && fieldRef.current && initialValue !== null) {
      commit(initialValue);
      return;
    }
    setActive('value');
  }, [isEdit, initialValue, commit]);

  const handleValueChange = useCallback((value: string | null) => {
    pendingValueRef.current = value;
  }, []);

  const handleValueConfirm = useCallback(() => {
    const picked = pendingValueRef.current;
    pendingValueRef.current = null;
    // an empty confirm keeps the previous value when editing, and closes an empty draft
    const value = picked ?? initialValue;
    if (fieldRef.current && value !== null) {
      commit(value);
      return;
    }
    setActive(null);
  }, [initialValue, commit]);

  const deactivate = useCallback(() => {
    if (isEdit) {
      onCancel();
      return;
    }
    setActive(null);
  }, [isEdit, onCancel]);

  return (
    <FieldLoadersProvider value={loaders}>
      <SegmentedChip
        onRemove={onCancel}
        removeAriaLabel={isEdit ? 'Cancel editing filter' : 'Cancel new filter'}
      >
        <PlaceholderChip
          variant='seamless'
          segment={fieldSegment}
          isActive={active === 'field'}
          onClick={() => setActive('field')}
          onValueChange={handleFieldChange}
          onConfirm={handleFieldConfirm}
          onDeactivate={handleFieldDeactivate}
        />
        <PlaceholderChip
          variant='seamless'
          segment={operatorSegment}
          isActive={active === 'operator'}
          onClick={() => setActive('operator')}
          onValueChange={handleOperatorChange}
          onConfirm={handleOperatorConfirm}
          onDeactivate={deactivate}
        />
        <PlaceholderChip
          variant='seamless'
          segment={valueSegment}
          isActive={active === 'value'}
          onClick={() => setActive('value')}
          onValueChange={handleValueChange}
          onConfirm={handleValueConfirm}
          onDeactivate={deactivate}
          dependencyValue={field}
        />
      </SegmentedChip>
    </FieldLoadersProvider>
  );
};
