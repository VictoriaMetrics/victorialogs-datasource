import React, { useCallback, useMemo } from 'react';

import { AbsoluteTimeRange, DataFrame, TimeRange } from '@grafana/data';
import { Button, Icon, IconButton, Stack, Text } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { FieldHits, Query } from '../../../types';

import { FieldValuesTable } from './FieldValuesTable';
import { buildFieldPresenceVolumeQuery } from './queries/drilldownQueries';
import { useFieldLogsSample } from './queries/useLogsSampleQueries';
import { BreakdownTable, BreakdownTableItem, TransformedVolume } from './shared/BreakdownTable';
import { ExpandedLogsPanel } from './shared/ExpandedLogsPanel';
import { STACKED_BARS_CHART_FIELD_CONFIG, getLevelGrouping, transformLevelVolume } from './shared/levelVolume';

interface StreamFieldsBreakdownProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  range: TimeRange;
  /** Stream fields with their hit counts */
  streamFields: FieldHits[];
  loading: boolean;
  error?: string;
  /** The stream field whose values are open. Undefined shows the list of fields */
  drillField?: string;
  onDrillFieldChange: (field: string | undefined) => void;
  onFilterClick: (field: string, value: string, operator: '=' | '!=') => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/**
 * Two-level stream-fields breakdown. The first level lists the stream fields, and clicking one
 * opens the same per-value table the field tabs use. The parent owns which field is open, and
 * a "Stream fields / field" breadcrumb shows it
 */
export const StreamFieldsBreakdown: React.FC<StreamFieldsBreakdownProps> = ({
  datasource,
  query,
  range,
  streamFields,
  loading,
  error,
  drillField,
  onDrillFieldChange,
  onFilterClick,
  onChangeTimeRange,
}) => {
  // the endpoint already answers in this order, but sorting here keeps the most voluminous
  // fields on top even if that ever changes
  const items = useMemo<BreakdownTableItem[]>(
    () =>
      streamFields
        .map((f) => ({ label: f.value, total: f.hits }))
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
    [streamFields]
  );

  const buildVolumeQuery = useCallback(
    // the query groups by the level fields too, so each sparkline can split by level
    (label: string, refIdSuffix: number) =>
      buildFieldPresenceVolumeQuery(query, label, getLevelGrouping(datasource), range, refIdSuffix),
    [datasource, query, range]
  );

  const transformVolume = useCallback(
    (frames: DataFrame[], r: TimeRange): TransformedVolume => transformLevelVolume(datasource, frames, r),
    [datasource]
  );

  const renderActions = useCallback(
    (label: string) => (
      <IconButton
        name='angle-right'
        aria-label={`Break down by ${label}`}
        tooltip={`Break down by ${label}`}
        onClick={() => onDrillFieldChange(label)}
      />
    ),
    [onDrillFieldChange]
  );

  const renderExpandedRow = useCallback(
    (label: string, index: number) => (
      <FieldExpandedLogs datasource={datasource} query={query} field={label} range={range} index={index} />
    ),
    [datasource, query, range]
  );

  if (drillField) {
    return (
      <Stack direction='column' gap={1}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <Button fill='text' size='sm' onClick={() => onDrillFieldChange(undefined)}>
            Stream fields
          </Button>
          <Icon name='angle-right' />
          <Text variant='bodySmall' color='secondary'>
            {drillField}
          </Text>
        </Stack>
        <FieldValuesTable
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
    <BreakdownTable
      items={items}
      loading={loading}
      error={error}
      noun='stream fields'
      searchPlaceholder='Search stream fields'
      labelHeader='Field'
      onLabelClick={onDrillFieldChange}
      datasource={datasource}
      range={range}
      buildVolumeQuery={buildVolumeQuery}
      transformVolume={transformVolume}
      chartFieldConfig={STACKED_BARS_CHART_FIELD_CONFIG}
      renderActions={renderActions}
      renderExpandedRow={renderExpandedRow}
      onChangeTimeRange={onChangeTimeRange}
    />
  );
};

interface FieldExpandedLogsProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  field: string;
  range: TimeRange;
  index: number;
}

const FieldExpandedLogs: React.FC<FieldExpandedLogsProps> = ({ datasource, query, field, range, index }) => {
  const logsData = useFieldLogsSample(datasource, query, field, range, true, index);
  return <ExpandedLogsPanel data={logsData} title={`${field} logs`} />;
};
