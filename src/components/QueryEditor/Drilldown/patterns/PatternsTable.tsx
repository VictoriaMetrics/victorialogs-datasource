import React, { useCallback, useMemo } from 'react';

import { AbsoluteTimeRange, LoadingState, TimeRange } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, Button, LoadingPlaceholder } from '@grafana/ui';

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

/** Patterns breakdown: the shared two-phase table, fed by the sampled patterns list, with Include/Exclude pipe filters */
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
      return (
        <>
          <Button
            size='sm'
            fill='outline'
            variant={applied?.type === 'include' ? 'primary' : 'secondary'}
            aria-label={`Include pattern ${label}`}
            onClick={() => onTogglePatternFilter(label, 'include')}
          >
            Include
          </Button>
          <Button
            size='sm'
            fill='outline'
            variant={applied?.type === 'exclude' ? 'primary' : 'secondary'}
            aria-label={`Exclude pattern ${label}`}
            onClick={() => onTogglePatternFilter(label, 'exclude')}
          >
            Exclude
          </Button>
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
