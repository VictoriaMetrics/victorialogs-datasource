import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { AbsoluteTimeRange, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Alert, EmptyState, IconButton, LoadingPlaceholder, Pagination, Stack, Text, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { formatHits } from '../../shared/formatHits';
import { BREAKDOWN_PAGE_SIZE } from '../queries/drilldownQueries';
import { useValueLogsSample } from '../queries/useLogsSampleQueries';
import { FieldValueVolume } from '../queries/useVolumeQueries';
import { useInView } from '../shared/useInView';

import { BreakdownRow } from './BreakdownRow';

interface FieldValuesBreakdownProps {
  field: string;
  top: FieldValueVolume[];
  totalValues: number;
  loading: boolean;
  error?: string;
  range: TimeRange;
  datasource: VictoriaLogsDatasource;
  query: Query;
  onFilterClick: (value: string, operator: '=' | '!=') => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
  /** fields_limit merged some hits into a remainder series, so the real value count is higher */
  serverTruncated?: boolean;
}

/** One row per value: a level-stacked hits chart next to a logs sample */
export const FieldValuesBreakdown: React.FC<FieldValuesBreakdownProps> = ({
  field,
  top,
  totalValues,
  loading,
  error,
  range,
  datasource,
  query,
  onFilterClick,
  onChangeTimeRange,
  serverTruncated,
}) => {
  const styles = useStyles2(getStyles);
  const [page, setPage] = useState(1);

  // a different field starts again from the first page
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [field]);

  const numberOfPages = Math.max(1, Math.ceil(top.length / BREAKDOWN_PAGE_SIZE));
  // clamp the page when a refetch shrinks the list below the current page
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage((prev) => Math.min(prev, numberOfPages));
  }, [numberOfPages]);

  // nothing to keep on screen: this is the first load, or a field switch just cleared `top`
  if (loading && !top.length) {
    return <LoadingPlaceholder text={`Loading ${field} values...`} />;
  }

  if (error) {
    return (
      <Alert severity='error' title={`Failed to load ${field} values`}>
        {error}
      </Alert>
    );
  }

  if (!loading && !top.length) {
    return <EmptyState variant='not-found' message='No data for the selected time range' />;
  }

  const pageRows = top.slice((page - 1) * BREAKDOWN_PAGE_SIZE, page * BREAKDOWN_PAGE_SIZE);

  return (
    <div className={loading ? styles.refetching : undefined}>
      <Stack direction='column' gap={1}>
        {pageRows.map((item, index) => (
          <ValueRow
            key={item.value}
            field={field}
            item={item}
            index={(page - 1) * BREAKDOWN_PAGE_SIZE + index}
            range={range}
            datasource={datasource}
            query={query}
            onFilterClick={onFilterClick}
            onChangeTimeRange={onChangeTimeRange}
          />
        ))}
        <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={setPage} hideWhenSinglePage />
        {(totalValues > top.length || serverTruncated) && (
          <span className={styles.truncationNote}>
            {/* fields_limit truncation understates totalValues itself — mark it with a "+" rather than presenting it as exact */}
            {`Loaded ${top.length} of ${totalValues}${serverTruncated ? '+' : ''} values`}
          </span>
        )}
      </Stack>
    </div>
  );
};

interface ValueRowProps {
  field: string;
  item: FieldValueVolume;
  index: number;
  range: TimeRange;
  datasource: VictoriaLogsDatasource;
  query: Query;
  onFilterClick: (value: string, operator: '=' | '!=') => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

const ValueRow: React.FC<ValueRowProps> = ({
  field,
  item,
  index,
  range,
  datasource,
  query,
  onFilterClick,
  onChangeTimeRange,
}) => {
  const styles = useStyles2(getStyles);
  const { value, total, volumeData } = item;
  const [inViewRef, inView] = useInView();
  const logsData = useValueLogsSample(datasource, query, field, value, range, inView, index);

  return (
    <BreakdownRow
      title={
        <>
          {/* display only — filters/aria-labels below keep using the raw (possibly empty) value */}
          <span className={styles.rowTitle}>{value || '(empty)'}</span>
          <Text color='secondary' variant='bodySmall'>{`(${formatHits(total)} hits)`}</Text>
        </>
      }
      panelTitle={value}
      actions={
        <>
          <IconButton
            name='search-plus'
            aria-label={`Filter for ${field}=${value}`}
            tooltip={`Filter for ${field}=${value}`}
            onClick={() => onFilterClick(value, '=')}
          />
          <IconButton
            name='search-minus'
            aria-label={`Filter out ${field}=${value}`}
            tooltip={`Filter out ${field}=${value}`}
            onClick={() => onFilterClick(value, '!=')}
          />
        </>
      }
      volumeData={volumeData}
      logsData={logsData}
      inViewRef={inViewRef}
      onChangeTimeRange={onChangeTimeRange}
      // the per-level legend uses the same series colors as the main volume chart
      showChartLegend
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  rowTitle: css({
    fontWeight: theme.typography.fontWeightMedium,
    overflowWrap: 'anywhere',
  }),
  truncationNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  // dims the rows while a refetch runs, instead of unmounting them
  refetching: css({
    opacity: 0.6,
    transition: 'opacity 0.2s',
  }),
});
