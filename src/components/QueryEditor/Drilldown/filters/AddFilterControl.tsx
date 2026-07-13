import React, { useCallback, useMemo, useRef, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { Button, ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';
import { SegmentedChip } from '../../../shared/Chip/SegmentedChip';
import { FieldLoadersProvider } from '../../TemplateBuilder/FieldLoadersContext';
import { PlaceholderChip } from '../../TemplateBuilder/PlaceholderChip';
import { PlaceholderSegment } from '../../TemplateBuilder/types';
import { useFieldFetch } from '../../shared/useFieldFetch';
import { PatternFilter } from '../patterns/patternFilters';
import { buildLookupQuery } from '../queries/drilldownQueries';

/** The only two operators offered by the "+ Filter" chips — matches the value-click affordances in FieldValuesBreakdown */
type AddFilterOperator = '=' | '!=';

const OPERATOR_OPTIONS: ComboboxOption[] = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
];

type ActiveSegment = 'field' | 'operator' | 'value';

interface AddFilterControlProps {
  datasource: VictoriaLogsDatasource;
  /** Editor filters plus drawer-local ones — narrows the field/value lookups */
  existingFilters: AdHocFilter[];
  /** Pattern include/exclude filters — narrow the lookups the same way they narrow every data query */
  patternFilters?: PatternFilter[];
  timeRange: TimeRange;
  onAdd: (filter: AdHocFilter) => void;
}

/**
 * "+ Filter" affordance in the query-builder style: clicking it opens an inline
 * `field [operator] value` chip group where every segment is a PlaceholderChip —
 * an in-place input whose options dropdown is anchored to the chip itself,
 * exactly like the filter segments of the template builder
 */
export const AddFilterControl: React.FC<AddFilterControlProps> = ({
  datasource,
  existingFilters,
  patternFilters = [],
  timeRange,
  onAdd,
}) => {
  const [editing, setEditing] = useState(false);

  const handleAdd = useCallback(
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
    <NewFilterDraft
      datasource={datasource}
      existingFilters={existingFilters}
      patternFilters={patternFilters}
      timeRange={timeRange}
      onAdd={handleAdd}
      onCancel={handleCancel}
    />
  );
};

interface NewFilterDraftProps {
  datasource: VictoriaLogsDatasource;
  existingFilters: AdHocFilter[];
  patternFilters: PatternFilter[];
  timeRange: TimeRange;
  onAdd: (filter: AdHocFilter) => void;
  onCancel: () => void;
}

/**
 * The in-progress filter being composed: `field [operator] value` chips. Mounted only
 * while a draft is open (its lookup machinery lives and dies with it), so cancelling
 * is simply an unmount
 */
const NewFilterDraft: React.FC<NewFilterDraftProps> = ({
  datasource,
  existingFilters,
  patternFilters,
  timeRange,
  onAdd,
  onCancel,
}) => {
  const [active, setActive] = useState<ActiveSegment | null>('field');
  const [field, setField] = useState<string | null>(null);
  const [operator, setOperator] = useState<AddFilterOperator>('=');
  // refs mirror the picked values — PlaceholderChip calls onValueChange and onConfirm
  // synchronously back-to-back, before the corresponding state updates have landed
  const fieldRef = useRef<string | null>(null);
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
      id: 'add-filter-field',
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
      id: 'add-filter-operator',
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
      id: 'add-filter-value',
      role: 'fieldValue',
      value: null,
      displayHint: 'value',
      optionSource: 'fieldValues',
      dependsOn: 'add-filter-field',
    }),
    []
  );

  const handleFieldChange = useCallback((value: string | null) => {
    fieldRef.current = value;
    setField(value);
  }, []);

  const handleFieldConfirm = useCallback(() => {
    // a confirmed field moves the editing on to the operator (then value); an empty confirm just deactivates
    setActive(fieldRef.current ? 'operator' : null);
  }, []);

  const handleFieldDeactivate = useCallback(() => {
    // abandoning the picker before a field is chosen collapses the draft back to the button
    if (!fieldRef.current) {
      onCancel();
      return;
    }
    setActive(null);
  }, [onCancel]);

  const handleOperatorChange = useCallback((value: string | null) => {
    setOperator(value === '!=' ? '!=' : '=');
  }, []);

  const handleValueChange = useCallback((value: string | null) => {
    pendingValueRef.current = value;
  }, []);

  const handleValueConfirm = useCallback(() => {
    const value = pendingValueRef.current;
    pendingValueRef.current = null;
    if (fieldRef.current && value) {
      onAdd({ key: fieldRef.current, value, operator });
      return;
    }
    setActive(null);
  }, [operator, onAdd]);

  const deactivate = useCallback(() => setActive(null), []);

  return (
    <FieldLoadersProvider value={loaders}>
      <SegmentedChip onRemove={onCancel} removeAriaLabel='Cancel new filter'>
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
          onConfirm={() => setActive('value')}
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
