import React, { useCallback, useMemo } from 'react';

import { AbsoluteTimeRange, TimeRange } from '@grafana/data';
import { IconButton } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { buildPatternVolumeQuery } from '../queries/drilldownQueries';
import { PatternListItem } from '../queries/useListQueries';
import { usePatternLogsSample } from '../queries/useLogsSampleQueries';
import { BreakdownTable, BreakdownTableItem } from '../shared/BreakdownTable';
import { ExpandedLogsPanel } from '../shared/ExpandedLogsPanel';

import { PatternFilter } from './patternFilters';

interface PatternsTableProps {
  patterns: PatternListItem[];
  loading: boolean;
  error?: string;
  range: TimeRange;
  datasource: VictoriaLogsDatasource;
  query: Query;
  patternFilters: PatternFilter[];
  onTogglePatternFilter: (pattern: string, type: PatternFilter['type']) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
  /** The list query hit its cap, so the real pattern count is higher */
  serverTruncated?: boolean;
}

/** Patterns breakdown: the shared table fed by the sampled patterns list, plus the filter for and filter out toggles */
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
      // an applied filter keeps its icon highlighted, and clicking it again removes the filter
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

const PatternExpandedLogs: React.FC<PatternExpandedLogsProps> = ({ datasource, query, pattern, range, index }) => {
  const logsData = usePatternLogsSample(datasource, query, pattern, range, true, index);
  return <ExpandedLogsPanel data={logsData} title={`${pattern} logs`} />;
};
