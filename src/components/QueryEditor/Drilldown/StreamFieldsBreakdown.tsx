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
import { STACKED_BARS_CHART_FIELD_CONFIG, getLevelFields, transformLevelVolume } from './shared/levelVolume';

interface StreamFieldsBreakdownProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  range: TimeRange;
  /** Stream fields with hit counts, already sorted by hits desc (loaded by the parent) */
  streamFields: FieldHits[];
  loading: boolean;
  error?: string;
  /** The stream field whose values level is open; undefined shows the fields level */
  drillField?: string;
  onDrillFieldChange: (field: string | undefined) => void;
  onFilterClick: (field: string, value: string, operator: '=' | '!=') => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/**
 * Two-level stream-fields breakdown: the fields level lists the stream fields by hits
 * (in the same table as the value breakdowns), and clicking a field opens its values
 * level — the exact per-value table used by the service-like tabs. The open field is
 * owned by the parent, shown as a "Stream fields / field" breadcrumb
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
  const items = useMemo<BreakdownTableItem[]>(
    () => streamFields.map((f) => ({ label: f.value, total: f.hits })),
    [streamFields]
  );

  const buildVolumeQuery = useCallback(
    // level fields are requested alongside so each field's sparkline can be split by level
    (label: string, refIdSuffix: number) =>
      buildFieldPresenceVolumeQuery(query, label, getLevelFields(datasource), range, refIdSuffix),
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

/** Expanded-row content: the sample of logs carrying the stream field */
const FieldExpandedLogs: React.FC<FieldExpandedLogsProps> = ({ datasource, query, field, range, index }) => {
  const logsData = useFieldLogsSample(datasource, query, field, range, true, index);
  return <ExpandedLogsPanel data={logsData} title={`${field} logs`} />;
};
