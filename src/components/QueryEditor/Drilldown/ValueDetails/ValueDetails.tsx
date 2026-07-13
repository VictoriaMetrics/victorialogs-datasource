import React, { useCallback, useMemo, useState } from 'react';

import { AbsoluteTimeRange, FieldType, LoadingState, PanelData, TimeRange } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, IconButton, LoadingPlaceholder, Stack, Tab, TabsBar, Text } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { PatternsTable } from '../patterns/PatternsTable';
import { PatternFilter } from '../patterns/patternFilters';
import { useFacets, useStreamFieldNames } from '../queries/useFieldListQueries';
import { usePatternsList } from '../queries/useListQueries';
import { useQueryLogsSample } from '../queries/useLogsSampleQueries';
import { useLogsVolume } from '../queries/useVolumeQueries';
import { NoDataPlaceholder } from '../shared/NoDataPlaceholder';
import { makeCounterSuffix } from '../shared/TabCounterSuffix';
import { useElementWidth } from '../shared/useElementWidth';
import { useRemainingHeight } from '../shared/useRemainingHeight';

import { FieldValuesSection } from './FieldValuesSection';
import { FieldsBreakdownGrid } from './FieldsBreakdownGrid';
import { VolumePanel } from './VolumePanel';

/** Internal fields that make no sense as breakdown cards on either tab */
const INTERNAL_FIELDS = new Set(['_time', '_stream', '_stream_id', '_msg']);

type DetailsTab = 'logs' | 'streams' | 'fields' | 'patterns';

interface ValueDetailsProps {
  datasource: VictoriaLogsDatasource;
  /** The drawer query with the selected value's filter already merged in */
  query: Query;
  range: TimeRange;
  /** All field names of the current selection, loaded by the drawer */
  fieldNames: string[];
  /** Narrowing query for the lookup endpoints — same chips as the data queries (see buildLookupQuery) */
  lookupQuery: string;
  onFilterClick: (field: string, value: string, operator: '=' | '!=') => void;
  patternFilters: PatternFilter[];
  onTogglePatternFilter: (pattern: string, type: PatternFilter['type']) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/** Sums all numeric samples across the volume series — the total log count of the current selection */
const sumHits = (volume: PanelData): number =>
  volume.series.reduce(
    (acc, frame) =>
      acc +
      frame.fields
        .filter((f) => f.type === FieldType.number)
        .reduce((fieldAcc, f) => fieldAcc + f.values.reduce((a: number, v) => a + (v ?? 0), 0), 0),
    0
  );

/** Drill-in view for one selected breakdown value: its volume chart plus Logs / Streams / Fields / Patterns tabs */
export const ValueDetails: React.FC<ValueDetailsProps> = ({
  datasource,
  query,
  range,
  fieldNames,
  lookupQuery,
  onFilterClick,
  patternFilters,
  onTogglePatternFilter,
  onChangeTimeRange,
}) => {
  const [activeTab, setActiveTab] = useState<DetailsTab>('logs');
  // level-2 state of the Streams/Fields tabs: a field whose per-value breakdown is open
  const [drillField, setDrillField] = useState<string>();

  const volume = useLogsVolume(datasource, query, range);
  const streams = useStreamFieldNames(datasource, range, lookupQuery);
  const facetsEnabled = activeTab === 'streams' || activeTab === 'fields';
  const facets = useFacets(datasource, query, range, facetsEnabled);
  // always enabled — the Patterns tab badge needs the count before the tab is opened
  const patterns = usePatternsList(datasource, query, range, true);
  const logsData = useQueryLogsSample(datasource, query, range, activeTab === 'logs');

  const onSelectTab = useCallback((tab: DetailsTab) => {
    setActiveTab(tab);
    // a field opened on one tab must not leak into the other tab's level 2
    setDrillField(undefined);
  }, []);

  const { streamFacets, otherFacets, streamFallback, otherFallback } = useMemo(() => {
    const streamSet = new Set(streams.streamFieldNames);
    const isOther = (name: string) => !streamSet.has(name) && !INTERNAL_FIELDS.has(name);
    return {
      streamFacets: facets.facets.filter((f) => streamSet.has(f.name)),
      otherFacets: facets.facets.filter((f) => isOther(f.name)),
      streamFallback: streams.streamFieldNames,
      otherFallback: fieldNames.filter(isOther),
    };
  }, [facets.facets, streams.streamFieldNames, fieldNames]);

  const logsCount = useMemo(() => sumHits(volume), [volume]);

  // memoized so each Tab's suffix keeps a stable component identity while its count is unchanged
  const counterSuffixes = useMemo(
    () => ({
      logs: makeCounterSuffix(logsCount),
      streams: makeCounterSuffix(streamFallback.length),
      fields: makeCounterSuffix(otherFallback.length),
      patterns: makeCounterSuffix(patterns.totalPatterns),
    }),
    [logsCount, streamFallback.length, otherFallback.length, patterns.totalPatterns]
  );

  const renderBreakdownTab = (tabFacets: typeof streamFacets, fallbackFieldNames: string[]) => {
    if (drillField) {
      return (
        <Stack direction='column' gap={1}>
          <Stack direction='row' gap={1} alignItems='center'>
            <IconButton
              name='arrow-left'
              aria-label='Back to fields'
              tooltip='Back to fields'
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
        // remount per tab: the grid's pagination state must not leak between Streams and Fields
        key={activeTab}
        datasource={datasource}
        query={query}
        range={range}
        facets={tabFacets}
        fallbackFieldNames={fallbackFieldNames}
        facetsLoading={facets.loading || streams.loading}
        facetsError={facets.error}
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
          label='Streams'
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
      {activeTab === 'streams' && renderBreakdownTab(streamFacets, streamFallback)}
      {activeTab === 'fields' && renderBreakdownTab(otherFacets, otherFallback)}
      {activeTab === 'patterns' && (
        <PatternsTable
          patterns={patterns.patterns}
          totalPatterns={patterns.totalPatterns}
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

/** Raw-logs list for the Logs tab, stretched to the bottom of the viewport */
const LogsTabContent: React.FC<{ data: PanelData }> = ({ data }) => {
  const [widthRef, width] = useElementWidth();
  const [heightRef, height] = useRemainingHeight();
  const isLoading = data.state === LoadingState.Loading;
  const hasSeries = data.series.length > 0;

  return (
    <div
      ref={(node) => {
        widthRef(node);
        heightRef(node);
      }}
    >
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
          options={{
            showTime: true,
            wrapLogMessage: false,
            enableLogDetails: true,
            dedupStrategy: 'none',
            sortOrder: 'Descending',
            fontSize: 'small',
          }}
        />
      )}
    </div>
  );
};
