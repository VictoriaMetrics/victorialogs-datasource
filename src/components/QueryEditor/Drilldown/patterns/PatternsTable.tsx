import React, { useCallback, useMemo } from 'react';

import { AbsoluteTimeRange, LoadingState, TimeRange } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, IconButton, LoadingPlaceholder } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { buildPatternVolumeQuery } from '../queries/drilldownQueries';
import { PatternListItem } from '../queries/useListQueries';
import { usePatternLogsSample } from '../queries/useLogsSampleQueries';
import { BreakdownTable, BreakdownTableItem } from '../shared/BreakdownTable';
import { NoDataPlaceholder } from '../shared/NoDataPlaceholder';
import { useElementWidth } from '../shared/useElementWidth';

import { PatternFilter } from './patternFilters';

const EXPANDED_LOGS_HEIGHT = 260;

interface PatternsTableProps {
  patterns: PatternListItem[];
  totalPatterns: number;
  loading: boolean;
  error?: string;
  range: TimeRange;
  datasource: VictoriaLogsDatasource;
  query: Query;
  patternFilters: PatternFilter[];
  onTogglePatternFilter: (pattern: string, type: PatternFilter['type']) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
  /** true when the list query hit its cap — the real pattern count is understated */
  serverTruncated?: boolean;
}

/** Patterns breakdown: the shared two-phase table, fed by the sampled patterns list, with filter for/out pipe-filter toggles */
export const PatternsTable: React.FC<PatternsTableProps> = ({
  patterns,
  loading,
  error,
  range,
  datasource,
  query,
  patternFilters,
  onTogglePatternFilter,
  onChangeTimeRange,
  serverTruncated,
}) => {
  const items = useMemo<BreakdownTableItem[]>(
    () => patterns.map((p) => ({ label: p.pattern, total: p.approxTotal, approx: true })),
    [patterns]
  );

  const buildVolumeQuery = useCallback(
    (label: string, refIdSuffix: number) => buildPatternVolumeQuery(query, label, range, refIdSuffix),
    [query, range]
  );

  const renderActions = useCallback(
    (label: string) => {
      const applied = patternFilters.find((f) => f.pattern === label);
      // an applied filter keeps its icon highlighted; clicking it again removes the filter
      return (
        <>
          <IconButton
            name='search-plus'
            variant={applied?.type === 'include' ? 'primary' : 'secondary'}
            aria-label={`Filter for pattern ${label}`}
            tooltip={applied?.type === 'include' ? 'Remove pattern filter' : 'Filter for pattern'}
            onClick={() => onTogglePatternFilter(label, 'include')}
          />
          <IconButton
            name='search-minus'
            variant={applied?.type === 'exclude' ? 'primary' : 'secondary'}
            aria-label={`Filter out pattern ${label}`}
            tooltip={applied?.type === 'exclude' ? 'Remove pattern filter' : 'Filter out pattern'}
            onClick={() => onTogglePatternFilter(label, 'exclude')}
          />
        </>
      );
    },
    [patternFilters, onTogglePatternFilter]
  );

  const renderExpandedRow = useCallback(
    (label: string, index: number) => (
      <PatternExpandedLogs datasource={datasource} query={query} pattern={label} range={range} index={index} />
    ),
    [datasource, query, range]
  );

  return (
    <BreakdownTable
      items={items}
      loading={loading}
      error={error}
      serverTruncated={serverTruncated}
      noun='patterns'
      searchPlaceholder='Search patterns'
      datasource={datasource}
      range={range}
      buildVolumeQuery={buildVolumeQuery}
      renderActions={renderActions}
      renderExpandedRow={renderExpandedRow}
      onChangeTimeRange={onChangeTimeRange}
    />
  );
};

interface PatternExpandedLogsProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  pattern: string;
  range: TimeRange;
  index: number;
}

/** Expanded-row content: the sample of logs matching the pattern */
const PatternExpandedLogs: React.FC<PatternExpandedLogsProps> = ({ datasource, query, pattern, range, index }) => {
  const [ref, width] = useElementWidth();
  const logsData = usePatternLogsSample(datasource, query, pattern, range, true, index);
  const isLoading = logsData.state === LoadingState.Loading;
  const hasSeries = logsData.series.length > 0;

  return (
    <div ref={ref}>
      {isLoading && !hasSeries && <LoadingPlaceholder text='Loading logs...' />}
      {logsData.state === LoadingState.Error && (
        <Alert severity='error' title='Failed to load logs'>
          {logsData.errors?.[0]?.message}
        </Alert>
      )}
      {logsData.state === LoadingState.Done && !hasSeries && <NoDataPlaceholder height={EXPANDED_LOGS_HEIGHT} />}
      {width > 0 && hasSeries && (
        <PanelRenderer
          pluginId='logs'
          title={`${pattern} logs`}
          data={logsData}
          width={width}
          height={EXPANDED_LOGS_HEIGHT}
          options={{
            showTime: true,
            wrapLogMessage: false,
            enableLogDetails: false,
            dedupStrategy: 'none',
            sortOrder: 'Descending',
            fontSize: 'small',
          }}
        />
      )}
    </div>
  );
};
