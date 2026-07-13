import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { AbsoluteTimeRange, dateTime, getDefaultTimeRange, TimeRange } from '@grafana/data';
import { Button, Drawer, EmptyState, LoadingPlaceholder, Stack, TimeRangePicker } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { AdHocFilter, Query } from '../../../types';

import { FieldValuesTable } from './FieldValuesTable';
import { MainFieldTabs, PATTERNS_TAB } from './MainFieldTabs';
import { ValueDetails } from './ValueDetails/ValueDetails';
import { detectBreakdownField, STREAM_FIELD } from './breakdownField';
import { DrilldownFiltersRow } from './filters/DrilldownFiltersRow';
import { PatternsTable } from './patterns/PatternsTable';
import { applyPatternFilters, PatternFilter, stripPatternFilterPipes, togglePatternFilter } from './patterns/patternFilters';
import { buildLookupQuery } from './queries/drilldownQueries';
import { useFieldNames, useStreamFieldNames } from './queries/useFieldListQueries';
import { usePatternsList } from './queries/useListQueries';
import { makeCounterSuffix } from './shared/TabCounterSuffix';

const toAbsoluteTimeRange = (from: number, to: number): TimeRange => {
  const range = { from: dateTime(from), to: dateTime(to) };
  return { ...range, raw: range };
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
 * Drilldown drawer with two views driven by one piece of state — the filters:
 * a main view with one breakdown tab per field (the first tab auto-detected as the
 * service-like field, more addable via "+"), each row offering a "Show logs" drill-in,
 * and a details view (Logs / Streams / Fields / Patterns tabs) shown while a
 * `activeTab = value` filter is present. Removing that filter chip returns to the main view
 */
const DrilldownDrawer: React.FC<DrilldownDrawerProps> = ({
  datasource,
  query,
  range,
  onChange,
  onRunQuery,
  onClose,
}) => {
  // memoized so `getDefaultTimeRange()`'s fresh timestamps don't produce a new range on every
  // render — hooks below key their effects off `range.from`/`range.to`, and a changing range
  // would re-trigger the volume/hits requests in an infinite loop
  const editorRange = useMemo(() => range ?? getDefaultTimeRange(), [range]);
  const [zoomRange, setZoomRange] = useState<TimeRange>();

  // the single source of narrowing inside the drawer; every drilldown session starts clean —
  // nothing is seeded from the editor, and nothing touches the editor's query until
  // "Go to editor" is pressed
  const [filters, setFilters] = useState<AdHocFilter[]>([]);
  // pattern include/exclude filters — expressed as a pipe chain on the query, not as adHoc chips
  const [patternFilters, setPatternFilters] = useState<PatternFilter[]>([]);
  // main-view breakdown tabs; the first ones are auto-detected once the field lists load
  const [fieldTabs, setFieldTabs] = useState<string[]>([]);
  // the seeded tabs stay unclosable so the main view never loses its default entry points
  const [defaultTabs, setDefaultTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>();
  // patterns over the whole selection are the drawer's most expensive query — run them only
  // after the user opens the Patterns tab once (then keep them fresh so the badge persists)
  const [patternsOpened, setPatternsOpened] = useState(false);

  // the drilldown deliberately ignores the editor's narrowing (expression, adHocFilters,
  // streamFilters) — it explores the whole log stream (`*`) narrowed only by its own chips:
  // adHocFilters serialize into extra_filters on every query type, pattern filters enter
  // as a collapse/filter/restore pipe chain
  const drawerQuery = useMemo(
    () => ({ ...query, expr: applyPatternFilters('*', patternFilters), adHocFilters: filters, streamFilters: undefined }),
    [query, filters, patternFilters]
  );

  // narrows the field/value lookup endpoints (field_names, field_values, stream_field_names)
  // by the same chips as the data queries
  const lookupQuery = useMemo(
    () => buildLookupQuery(datasource, filters, patternFilters),
    [datasource, filters, patternFilters]
  );

  // a zoom narrows the drawer to a sub-interval of the editor range; once the editor
  // range itself changes the old zoom no longer relates to it — drop it
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoomRange(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorRange.from.valueOf(), editorRange.to.valueOf()]);

  const timeRange = zoomRange ?? editorRange;

  const onZoom = useCallback((absRange: AbsoluteTimeRange) => {
    setZoomRange(toAbsoluteTimeRange(absRange.from, absRange.to));
  }, []);

  const onZoomOut = useCallback(() => {
    const from = timeRange.from.valueOf();
    const to = timeRange.to.valueOf();
    const half = (to - from) / 2;
    // clamp the widened range to "now" — otherwise repeated zoom-outs drift into the future,
    // leaving an empty right half on every chart
    setZoomRange(toAbsoluteTimeRange(from - half, Math.min(to + half, Date.now())));
  }, [timeRange]);

  const onZoomReset = useCallback(() => setZoomRange(undefined), []);

  const onMoveBackward = useCallback(() => {
    const from = timeRange.from.valueOf();
    const to = timeRange.to.valueOf();
    const half = (to - from) / 2;
    setZoomRange(toAbsoluteTimeRange(from - half, to - half));
  }, [timeRange]);

  const onMoveForward = useCallback(() => {
    const from = timeRange.from.valueOf();
    const to = timeRange.to.valueOf();
    const half = (to - from) / 2;
    // clamp to "now", same as onZoomOut — otherwise repeated forward moves drift past the present
    setZoomRange(toAbsoluteTimeRange(from + half, Math.min(to + half, Date.now())));
  }, [timeRange]);

  const onChangeTimeZone = useCallback(() => {}, []);

  const fields = useFieldNames(datasource, timeRange, lookupQuery);
  const streams = useStreamFieldNames(datasource, timeRange, lookupQuery);

  // seed the default breakdown tabs once both name lists are in: the detected service-like
  // field plus a streams tab (one row per unique `{...}` stream); user-managed tabs win afterwards
  useEffect(() => {
    if (fieldTabs.length > 0 || fields.loading || streams.loading) {
      return;
    }
    const detected = detectBreakdownField(fields.fieldNames, streams.streamFieldNames);
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
  }, [fieldTabs.length, fields.loading, streams.loading, fields.fieldNames, streams.streamFieldNames]);

  // navigation state IS the filter: an `activeTab = value` filter means the details
  // view is open for that value; removing the chip in DrilldownFiltersRow goes back.
  // The Patterns tab is not a field — it never derives a drill-in
  const selectedValue = useMemo(
    () =>
      activeTab && activeTab !== PATTERNS_TAB
        ? filters.find((f) => f.key === activeTab && f.operator === '=')
        : undefined,
    [filters, activeTab]
  );

  // main-view patterns — idle until the tab is first opened, paused while a drill-in is
  // active (ValueDetails runs its own patterns query for the narrowed selection)
  const mainPatterns = usePatternsList(datasource, drawerQuery, timeRange, patternsOpened && !selectedValue);
  const patternsCounter = useMemo(() => makeCounterSuffix(mainPatterns.totalPatterns), [mainPatterns.totalPatterns]);

  const onSelectMainTab = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === PATTERNS_TAB) {
      setPatternsOpened(true);
    }
  }, []);

  // shared by all filter-adding paths (value clicks in breakdowns, or the field/operator/value
  // picked via the "+ Filter" control) so they dedup identically
  const addFilter = useCallback((filter: AdHocFilter) => {
    const isMatch = (f: AdHocFilter) => f.key === filter.key && f.value === filter.value && f.operator === filter.operator;
    // functional form: two filter adds landing in the same render (e.g. two rapid clicks
    // batched by React) must each see the other's update rather than both reading the
    // same stale `filters` closure and one silently overwriting the other's append
    setFilters((prev) => (prev.some(isMatch) ? prev : [...prev, filter]));
  }, []);

  const onFilterClick = useCallback(
    (field: string, value: string, operator: '=' | '!=') => {
      addFilter({ key: field, value, operator });
    },
    [addFilter]
  );

  const onShowLogs = useCallback(
    (value: string) => {
      if (activeTab) {
        addFilter({ key: activeTab, value, operator: '=' });
      }
    },
    [activeTab, addFilter]
  );

  const onTogglePatternFilter = useCallback((pattern: string, type: PatternFilter['type']) => {
    setPatternFilters((prev) => togglePatternFilter(prev, pattern, type));
  }, []);

  const onApply = useCallback(() => {
    // the drawer's chips replace the editor's adHocFilters wholesale — the editor query
    // shows exactly the selection explored in the drilldown; pattern filters become part
    // of the expression — adHoc chips can't express pipe chains. Stripping a previously
    // applied chain first makes repeated Applies idempotent
    onChange({
      ...query,
      expr: applyPatternFilters(stripPatternFilterPipes(query.expr), patternFilters),
      adHocFilters: filters.length ? filters : undefined,
    });
    onRunQuery();
    // handing the selection to the editor is the end of the drilldown session
    onClose();
  }, [query, filters, patternFilters, onChange, onRunQuery, onClose]);

  const onAddFieldTab = useCallback((field: string) => {
    setFieldTabs((prev) => (prev.includes(field) ? prev : [...prev, field]));
    setActiveTab(field);
  }, []);

  const onCloseFieldTab = useCallback((field: string) => {
    setFieldTabs((prev) => {
      const next = prev.filter((f) => f !== field);
      // when the closed tab was the active one, fall back to the first remaining tab
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
          existingFilters={filters}
          onAdd={addFilter}
        />
        {selectedValue ? (
          <ValueDetails
            datasource={datasource}
            query={drawerQuery}
            range={timeRange}
            fieldNames={fields.fieldNames}
            lookupQuery={lookupQuery}
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
                totalPatterns={mainPatterns.totalPatterns}
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
            ) : (
              <FieldValuesTable
                datasource={datasource}
                query={drawerQuery}
                field={activeTab}
                range={timeRange}
                onFilterClick={onFilterClick}
                onShowLogs={onShowLogs}
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
