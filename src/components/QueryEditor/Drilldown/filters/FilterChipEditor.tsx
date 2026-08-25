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

/** Operators offered by the filter chip editor: exact match and regexp, each with its negation */
export type EditableFilterOperator = '=' | '!=' | '=~' | '!~';

const EDITABLE_OPERATORS: EditableFilterOperator[] = ['=', '!=', '=~', '!~'];

const OPERATOR_OPTIONS: ComboboxOption[] = EDITABLE_OPERATORS.map((op) => ({ label: op, value: op }));

/** The chip segments the editor can activate */
export type FilterSegment = 'field' | 'operator' | 'value';

const isEditableOperator = (value: string | null): value is EditableFilterOperator =>
  EDITABLE_OPERATORS.includes(value as EditableFilterOperator);

/** Whether a chip can be edited in place: single-value, not a level-button chip, with an operator the editor offers */
export const isEditableFilter = (f: AdHocFilter): boolean =>
  !isLevelChip(f) && !f.values?.length && isEditableOperator(f.operator);

interface FilterChipEditorProps {
  datasource: VictoriaLogsDatasource;
  /** Filters narrowing the field/value lookups; must NOT include the filter being edited */
  existingFilters: AdHocFilter[];
  /** Pattern include/exclude filters — narrow the lookups the same way they narrow every data query */
  patternFilters?: PatternFilter[];
  timeRange: TimeRange;
  /** When set, the editor edits this filter in place; otherwise it composes a new one */
  initialFilter?: AdHocFilter;
  /** Segment activated on mount — the one the user clicked; defaults to the field */
  initialSegment?: FilterSegment;
  onCommit: (filter: AdHocFilter) => void;
  onCancel: () => void;
}

/**
 * Inline `field [operator] value` chip editor in the query-builder style
 */
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
  // refs mirror the picked values — PlaceholderChip calls onValueChange and onConfirm
  // synchronously back-to-back, before the corresponding state updates have landed
  const fieldRef = useRef<string | null>(initialFilter?.key ?? null);
  const operatorRef = useRef<EditableFilterOperator>(
    initialFilter && isEditableOperator(initialFilter.operator) ? initialFilter.operator : '='
  );
  const pendingValueRef = useRef<string | null>(null);

  // same recipe as the drawer's other lookups: fold the chips and pattern pipes into the
  // narrowing query, dropping filters on the picked field so alternatives stay offered
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
      // fieldRef is always set on the commit paths — guarded at each call site
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
      // an empty confirm deactivates the draft; in edit mode it reverts the chip unchanged
      if (isEdit) {
        onCancel();
      } else {
        setActive(null);
      }
      return;
    }
    // a confirmed field moves the editing on: to the operator when composing, straight to the
    // value when editing (the pre-edit value rarely fits the new field)
    setActive(isEdit ? 'value' : 'operator');
  }, [isEdit, onCancel]);

  const handleFieldDeactivate = useCallback(() => {
    // abandoning the picker before a field is chosen collapses the draft back to the button;
    // in edit mode abandoning any segment reverts the chip unchanged
    if (isEdit || !fieldRef.current) {
      onCancel();
      return;
    }
    setActive(null);
  }, [isEdit, onCancel]);

  const handleOperatorChange = useCallback((value: string | null) => {
    // free-typed text that is not a known operator keeps the current one
    if (isEditableOperator(value)) {
      operatorRef.current = value;
      setOperator(value);
    }
  }, []);

  const handleOperatorConfirm = useCallback(() => {
    // editing an existing chip commits the operator change right away, keeping the value;
    // composing a new filter moves on to the value step
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
    // an empty confirm keeps the pre-edit value (edit mode); a draft without a value deactivates
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
