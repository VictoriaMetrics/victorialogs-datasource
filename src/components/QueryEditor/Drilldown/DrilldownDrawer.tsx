import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { AbsoluteTimeRange, dateTime, getDefaultTimeRange, TimeRange } from '@grafana/data';
import { Button, Drawer, EmptyState, LoadingPlaceholder, Stack, TimeRangePicker } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { AdHocFilter, Query } from '../../../types';
import { isLevelChip } from '../../../utils/query/levelChips';

import { FieldValuesTable } from './FieldValuesTable';
import { MainFieldTabs, PATTERNS_TAB } from './MainFieldTabs';
import { StreamFieldsBreakdown } from './StreamFieldsBreakdown';
import { ValueDetails } from './ValueDetails/ValueDetails';
import { detectBreakdownField, STREAM_FIELD } from './breakdownField';
import { DrilldownFiltersRow } from './filters/DrilldownFiltersRow';
import { LevelFilterRow } from './filters/LevelFilterRow';
import { PatternsTable } from './patterns/PatternsTable';
import { applyPatternFilters, PatternFilter, stripPatternFilterPipes, togglePatternFilter } from './patterns/patternFilters';
import { buildLookupQuery } from './queries/drilldownQueries';
import { useFieldNames, useStreamFields } from './queries/useFieldListQueries';
import { usePatternsList } from './queries/useListQueries';
import { hasDrilldownSelection } from './selection';
import { makeCounterSuffix } from './shared/TabCounterSuffix';

const toAbsoluteTimeRange = (from: number, to: number): TimeRange => {
  const range = { from: dateTime(from), to: dateTime(to) };
  return { ...range, raw: range };
};

/**
 * Moves `range` by `steps` half-widths and widens it by `grow` half-widths on each side. The
 * result is clamped to "now", otherwise repeated forward moves and zoom-outs drift into the
 * future and leave an empty right half on every chart
 */
const shiftRange = (range: TimeRange, steps: number, grow = 0): TimeRange => {
  const from = range.from.valueOf();
  const to = range.to.valueOf();
  const half = (to - from) / 2;
  return toAbsoluteTimeRange(from + (steps - grow) * half, Math.min(to + (steps + grow) * half, Date.now()));
};

export interface DrilldownDrawerProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  range?: TimeRange;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
  onClose: () => void;
}

/**
 * Drilldown drawer with two views: a main view of per-field breakdown tabs, and a details
 * view shown while an ad-hoc chip or a pattern filter narrows the selection. Removing them
 * returns to the main view. Log-level chips narrow without drilling in
 */
const DrilldownDrawer: React.FC<DrilldownDrawerProps> = ({
  datasource,
  query,
  range,
  onChange,
  onRunQuery,
  onClose,
}) => {
  // `getDefaultTimeRange()` returns fresh timestamps on every call. Without the memo, the hooks
  // keyed off `range.from` and `range.to` would re-trigger their requests in an infinite loop
  const editorRange = useMemo(() => range ?? getDefaultTimeRange(), [range]);
  const [zoomRange, setZoomRange] = useState<TimeRange>();

  const [filters, setFilters] = useState<AdHocFilter[]>([]);
  const [patternFilters, setPatternFilters] = useState<PatternFilter[]>([]);
  const [fieldTabs, setFieldTabs] = useState<string[]>([]);
  const [defaultTabs, setDefaultTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>();
  const [streamDrillField, setStreamDrillField] = useState<string>();
  const [patternsOpened, setPatternsOpened] = useState(false);

  // the drilldown deliberately ignores the editor's narrowing and explores the whole
  // stream (`*`) through its own chips only
  const drawerQuery = useMemo(
    () => ({ ...query, expr: applyPatternFilters('*', patternFilters), adHocFilters: filters, streamFilters: undefined }),
    [query, filters, patternFilters]
  );

  const lookupQuery = useMemo(
    () => buildLookupQuery(datasource, filters, patternFilters),
    [datasource, filters, patternFilters]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoomRange(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorRange.from.valueOf(), editorRange.to.valueOf()]);

  const timeRange = zoomRange ?? editorRange;

  const onZoom = useCallback((absRange: AbsoluteTimeRange) => {
    setZoomRange(toAbsoluteTimeRange(absRange.from, absRange.to));
  }, []);

  const onZoomOut = useCallback(() => setZoomRange(shiftRange(timeRange, 0, 1)), [timeRange]);

  const onZoomReset = useCallback(() => setZoomRange(undefined), []);

  const onMoveBackward = useCallback(() => setZoomRange(shiftRange(timeRange, -1)), [timeRange]);

  const onMoveForward = useCallback(() => setZoomRange(shiftRange(timeRange, 1)), [timeRange]);

  const onChangeTimeZone = useCallback(() => {}, []);

  const fields = useFieldNames(datasource, timeRange, lookupQuery);
  const streams = useStreamFields(datasource, timeRange, lookupQuery);
  const streamFieldNames = useMemo(() => streams.streamFields.map((f) => f.value), [streams.streamFields]);

  // seed the default tabs once, when both name lists are in; user-managed tabs win afterwards
  useEffect(() => {
    if (fieldTabs.length > 0 || fields.loading || streams.loading) {
      return;
    }
    const detected = detectBreakdownField(fields.fieldNames, streamFieldNames);
    const tabs = detected
      ? [detected, STREAM_FIELD]
      : fields.fieldNames.length
        ? [STREAM_FIELD]
        : [];
    if (tabs.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFieldTabs(tabs);
      setDefaultTabs(tabs);
      setActiveTab(tabs[0]);
    }
  }, [fieldTabs.length, fields.loading, streams.loading, fields.fieldNames, streamFieldNames]);

  const hasSelection = hasDrilldownSelection(filters, patternFilters);

  // the drawer's most expensive query. The first Patterns open latches it on, so the badge
  // stays fresh, and a drill-in pauses it because ValueDetails runs its own
  const mainPatterns = usePatternsList(datasource, drawerQuery, timeRange, patternsOpened && !hasSelection);
  const patternsCounter = useMemo(() => makeCounterSuffix(mainPatterns.totalPatterns), [mainPatterns.totalPatterns]);

  const onSelectMainTab = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === PATTERNS_TAB) {
      setPatternsOpened(true);
    }
  }, []);

  const addFilter = useCallback((filter: AdHocFilter) => {
    // a level-button chip and a literal chip on the same key/value are not duplicates:
    // only the marked one expands into the derived-level expression
    const isMatch = (f: AdHocFilter) =>
      f.key === filter.key &&
      f.value === filter.value &&
      f.operator === filter.operator &&
      isLevelChip(f) === isLevelChip(filter);
    // functional form: two adds batched into one render must each see the other's append
    setFilters((prev) => (prev.some(isMatch) ? prev : [...prev, filter]));
  }, []);

  const onFilterClick = useCallback(
    (field: string, value: string, operator: '=' | '!=') => {
      addFilter({ key: field, value, operator });
    },
    [addFilter]
  );

  const onTogglePatternFilter = useCallback((pattern: string, type: PatternFilter['type']) => {
    setPatternFilters((prev) => togglePatternFilter(prev, pattern, type));
  }, []);

  const onApply = useCallback(() => {
    // the drawer's chips replace the editor's adHocFilters wholesale; pattern filters can only
    // live in the expression, and stripping a previous chain keeps repeated Applies idempotent
    onChange({
      ...query,
      expr: applyPatternFilters(stripPatternFilterPipes(query.expr), patternFilters),
      adHocFilters: filters.length ? filters : undefined,
    });
    onRunQuery();
    onClose();
  }, [query, filters, patternFilters, onChange, onRunQuery, onClose]);

  const onAddFieldTab = useCallback((field: string) => {
    setFieldTabs((prev) => (prev.includes(field) ? prev : [...prev, field]));
    setActiveTab(field);
  }, []);

  const onCloseFieldTab = useCallback((field: string) => {
    setFieldTabs((prev) => {
      const next = prev.filter((f) => f !== field);
      setActiveTab((active) => (active === field ? next[0] : active));
      return next;
    });
  }, []);

  const zoomToolbar = (
    <Stack direction='row' gap={1} alignItems='center'>
      <TimeRangePicker
        value={timeRange}
        onChange={(r) => setZoomRange(r)}
        onZoom={onZoomOut}
        onMoveBackward={onMoveBackward}
        onMoveForward={onMoveForward}
        onChangeTimeZone={onChangeTimeZone}
      />
      {zoomRange && (
        <Button size='sm' variant='secondary' onClick={onZoomReset}>
          Reset
        </Button>
      )}
    </Stack>
  );

  const namesLoading = fields.loading || streams.loading;

  return (
    <Drawer title='Drilldown' size='lg' onClose={onClose}>
      <Stack direction='column' gap={2}>
        <DrilldownFiltersRow
          datasource={datasource}
          filters={filters}
          onFiltersChange={setFilters}
          patternFilters={patternFilters}
          onPatternFiltersChange={setPatternFilters}
          onApply={onApply}
          timeRange={timeRange}
          zoomToolbar={zoomToolbar}
          onAdd={addFilter}
        />
        <LevelFilterRow filters={filters} onFiltersChange={setFilters} />
        {hasSelection ? (
          <ValueDetails
            datasource={datasource}
            query={drawerQuery}
            range={timeRange}
            fieldNames={fields.fieldNames}
            streamFields={streams.streamFields}
            streamFieldsLoading={streams.loading}
            streamFieldsError={streams.error}
            onFilterClick={onFilterClick}
            patternFilters={patternFilters}
            onTogglePatternFilter={onTogglePatternFilter}
            onChangeTimeRange={onZoom}
          />
        ) : fieldTabs.length > 0 && activeTab ? (
          <>
            <MainFieldTabs
              tabs={fieldTabs}
              active={activeTab}
              unclosableTabs={defaultTabs}
              patternsCounter={patternsCounter}
              onSelect={onSelectMainTab}
              onAddField={onAddFieldTab}
              onCloseField={onCloseFieldTab}
              fieldNames={fields.fieldNames}
              fieldsLoading={fields.loading}
              fieldsError={fields.error}
            />
            {activeTab === PATTERNS_TAB ? (
              <PatternsTable
                patterns={mainPatterns.patterns}
                loading={mainPatterns.loading}
                error={mainPatterns.error}
                range={timeRange}
                datasource={datasource}
                query={drawerQuery}
                patternFilters={patternFilters}
                onTogglePatternFilter={onTogglePatternFilter}
                onChangeTimeRange={onZoom}
                serverTruncated={mainPatterns.serverTruncated}
              />
            ) : activeTab === STREAM_FIELD ? (
              <StreamFieldsBreakdown
                datasource={datasource}
                query={drawerQuery}
                range={timeRange}
                streamFields={streams.streamFields}
                loading={streams.loading}
                error={streams.error}
                drillField={streamDrillField}
                onDrillFieldChange={setStreamDrillField}
                onFilterClick={onFilterClick}
                onChangeTimeRange={onZoom}
              />
            ) : (
              <FieldValuesTable
                datasource={datasource}
                query={drawerQuery}
                field={activeTab}
                range={timeRange}
                onFilterClick={onFilterClick}
                onChangeTimeRange={onZoom}
              />
            )}
          </>
        ) : namesLoading ? (
          <LoadingPlaceholder text='Detecting breakdown field...' />
        ) : (
          <EmptyState variant='not-found' message='No fields for the selected time range' />
        )}
      </Stack>
    </Drawer>
  );
};

export default DrilldownDrawer;
