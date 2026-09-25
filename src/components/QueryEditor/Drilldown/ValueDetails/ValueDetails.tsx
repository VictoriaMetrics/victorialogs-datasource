import React, { useCallback, useMemo, useState } from 'react';

import { AbsoluteTimeRange, LoadingState, PanelData, TimeRange } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, IconButton, LoadingPlaceholder, Stack, Tab, TabsBar, Text } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { FieldHits, Query } from '../../../../types';
import { PatternsTable } from '../patterns/PatternsTable';
import { PatternFilter } from '../patterns/patternFilters';
import { sumFrameValues } from '../queries/drilldownQueries';
import { FacetField } from '../queries/facets';
import { useFacets } from '../queries/useFieldListQueries';
import { usePatternsList } from '../queries/useListQueries';
import { useQueryLogsSample } from '../queries/useLogsSampleQueries';
import { useLogsVolume } from '../queries/useVolumeQueries';
import { LOGS_PANEL_OPTIONS } from '../shared/ExpandedLogsPanel';
import { NoDataPlaceholder } from '../shared/NoDataPlaceholder';
import { makeCounterSuffix } from '../shared/TabCounterSuffix';
import { useElementWidth } from '../shared/useElementWidth';
import { useRemainingHeight } from '../shared/useRemainingHeight';
import { useDrilldownTimeZone } from '../timeZoneContext';

import { FieldValuesSection } from './FieldValuesSection';
import { FieldsBreakdownGrid } from './FieldsBreakdownGrid';
import { VolumePanel } from './VolumePanel';

/** Internal fields that make no sense as breakdown cards */
const INTERNAL_FIELDS = new Set(['_time', '_stream', '_stream_id', '_msg']);

type DetailsTab = 'logs' | 'streams' | 'fields' | 'patterns';

interface ValueDetailsProps {
  datasource: VictoriaLogsDatasource;
  /** The drawer query, with the selection's filters already merged in */
  query: Query;
  range: TimeRange;
  /** Every field name of the current selection, loaded by the drawer */
  fieldNames: string[];
  /** The selection's stream fields, loaded by the drawer */
  streamFields: FieldHits[];
  streamFieldsLoading: boolean;
  streamFieldsError?: string;
  onFilterClick: (field: string, value: string, operator: '=' | '!=') => void;
  patternFilters: PatternFilter[];
  onTogglePatternFilter: (pattern: string, type: PatternFilter['type']) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/** Details view of the current selection: its volume chart plus the Logs, Stream fields, Fields and Patterns tabs */
export const ValueDetails: React.FC<ValueDetailsProps> = ({
  datasource,
  query,
  range,
  fieldNames,
  streamFields,
  streamFieldsLoading,
  streamFieldsError,
  onFilterClick,
  patternFilters,
  onTogglePatternFilter,
  onChangeTimeRange,
}) => {
  const [activeTab, setActiveTab] = useState<DetailsTab>('logs');
  // the field whose per-value breakdown is open on the Stream fields or Fields tab
  const [drillField, setDrillField] = useState<string>();

  const volume = useLogsVolume(datasource, query, range);
  const streamFieldNames = useMemo(() => streamFields.map((f) => f.value), [streamFields]);
  // both breakdown tabs read the per-field value summaries: the cards on Fields, and the
  // constant-field strip on Stream fields
  const facetsEnabled = activeTab === 'fields' || activeTab === 'streams';
  const facets = useFacets(datasource, query, range, facetsEnabled);
  // always enabled, because the Patterns tab badge needs the count before anyone opens the tab
  const patterns = usePatternsList(datasource, query, range, true);
  const logsData = useQueryLogsSample(datasource, query, range, activeTab === 'logs');

  const onSelectTab = useCallback((tab: DetailsTab) => {
    setActiveTab(tab);
    // a field opened on one tab must not stay open on the other
    setDrillField(undefined);
  }, []);

  const { streamFacets, otherFacets, otherFallback } = useMemo(() => {
    const streamSet = new Set(streamFieldNames);
    const isOther = (name: string) => !streamSet.has(name) && !INTERNAL_FIELDS.has(name);
    return {
      streamFacets: facets.facets.filter((f) => streamSet.has(f.name)),
      otherFacets: facets.facets.filter((f) => isOther(f.name)),
      otherFallback: fieldNames.filter(isOther),
    };
  }, [facets.facets, streamFieldNames, fieldNames]);

  const logsCount = useMemo(() => sumFrameValues(volume.series), [volume]);

  // memoized so a Tab's suffix keeps one component identity while its count is unchanged
  const counterSuffixes = useMemo(
    () => ({
      logs: makeCounterSuffix(logsCount),
      streams: makeCounterSuffix(streamFields.length),
      fields: makeCounterSuffix(otherFallback.length),
      patterns: makeCounterSuffix(patterns.totalPatterns),
    }),
    [logsCount, streamFields.length, otherFallback.length, patterns.totalPatterns]
  );

  // both breakdown tabs render the same grid, over a different set of fields
  const renderBreakdownTab = (
    tabFacets: FacetField[],
    fallbackFieldNames: string[],
    noun: string,
    fieldsError?: string
  ) => {
    if (drillField) {
      return (
        <Stack direction='column' gap={1}>
          <Stack direction='row' gap={1} alignItems='center'>
            <IconButton
              name='arrow-left'
              aria-label={`Back to ${noun}`}
              tooltip={`Back to ${noun}`}
              onClick={() => setDrillField(undefined)}
            />
            <Text variant='bodySmall' color='secondary'>{`Breakdown by ${drillField}`}</Text>
          </Stack>
          <FieldValuesSection
            datasource={datasource}
            query={query}
            field={drillField}
            range={range}
            onFilterClick={onFilterClick}
            onChangeTimeRange={onChangeTimeRange}
          />
        </Stack>
      );
    }
    return (
      <FieldsBreakdownGrid
        // remount per tab, so the grid's pagination does not carry over between the two tabs
        key={activeTab}
        datasource={datasource}
        query={query}
        range={range}
        facets={tabFacets}
        fallbackFieldNames={fallbackFieldNames}
        facetsLoading={facets.loading || streamFieldsLoading}
        facetsError={facets.error}
        fieldsError={fieldsError}
        noun={noun}
        onSelectField={setDrillField}
        onChangeTimeRange={onChangeTimeRange}
      />
    );
  };

  return (
    <Stack direction='column' gap={2}>
      <VolumePanel data={volume} onChangeTimeRange={onChangeTimeRange} />
      <TabsBar>
        <Tab label='Logs' suffix={counterSuffixes.logs} active={activeTab === 'logs'} onChangeTab={() => onSelectTab('logs')} />
        <Tab
          label='Stream fields'
          suffix={counterSuffixes.streams}
          active={activeTab === 'streams'}
          onChangeTab={() => onSelectTab('streams')}
        />
        <Tab
          label='Fields'
          suffix={counterSuffixes.fields}
          active={activeTab === 'fields'}
          onChangeTab={() => onSelectTab('fields')}
        />
        <Tab
          label='Patterns'
          suffix={counterSuffixes.patterns}
          active={activeTab === 'patterns'}
          onChangeTab={() => onSelectTab('patterns')}
        />
      </TabsBar>
      {activeTab === 'logs' && <LogsTabContent data={logsData} />}
      {activeTab === 'streams' && renderBreakdownTab(streamFacets, streamFieldNames, 'stream fields', streamFieldsError)}
      {activeTab === 'fields' && renderBreakdownTab(otherFacets, otherFallback, 'fields')}
      {activeTab === 'patterns' && (
        <PatternsTable
          patterns={patterns.patterns}
          loading={patterns.loading}
          error={patterns.error}
          range={range}
          datasource={datasource}
          query={query}
          patternFilters={patternFilters}
          onTogglePatternFilter={onTogglePatternFilter}
          onChangeTimeRange={onChangeTimeRange}
          serverTruncated={patterns.serverTruncated}
        />
      )}
    </Stack>
  );
};

/** The Logs tab's raw-log list, stretched to the bottom of the viewport */
const LogsTabContent: React.FC<{ data: PanelData }> = ({ data }) => {
  const [widthRef, width] = useElementWidth();
  const [heightRef, height] = useRemainingHeight();
  const timeZone = useDrilldownTimeZone();
  const isLoading = data.state === LoadingState.Loading;
  const hasSeries = data.series.length > 0;
  // a stable merged ref, so the observers are not reconnected on every render
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      widthRef(node);
      heightRef(node);
    },
    [widthRef, heightRef]
  );

  return (
    <div ref={containerRef}>
      {data.state === LoadingState.Error && (
        <Alert severity='error' title='Failed to load logs'>
          {data.errors?.[0]?.message}
        </Alert>
      )}
      {/* a refetch keeps the previous series while Loading — only show the placeholder on first load */}
      {isLoading && !hasSeries && <LoadingPlaceholder text='Loading logs...' />}
      {data.state === LoadingState.Done && !hasSeries && <NoDataPlaceholder height={height} />}
      {width > 0 && hasSeries && (
        <PanelRenderer
          pluginId='logs'
          title='Logs'
          data={data}
          width={width}
          height={height}
          timeZone={timeZone}
          options={{ ...LOGS_PANEL_OPTIONS, enableLogDetails: true }}
        />
      )}
    </div>
  );
};
