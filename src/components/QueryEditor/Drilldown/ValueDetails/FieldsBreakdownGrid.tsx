import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { AbsoluteTimeRange, FieldConfigSource, GrafanaTheme2, LoadingState, TimeRange } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import {
  Alert,
  Button,
  EmptyState,
  LoadingPlaceholder,
  Pagination,
  PanelContextProvider,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { BREAKDOWN_PAGE_SIZE } from '../queries/drilldownQueries';
import { FacetField } from '../queries/facets';
import { useFieldVolume } from '../queries/useVolumeQueries';
import { NoDataPlaceholder } from '../shared/NoDataPlaceholder';
import { useElementWidth } from '../shared/useElementWidth';
import { useInView } from '../shared/useInView';
import { getSeriesLabels, useLegendSeriesToggle } from '../shared/useLegendSeriesToggle';

// includes the bottom legend listing the field's values with their sums
const CARD_CHART_HEIGHT = 220;

/** Stacked-bars styling for the per-field card chart — one series per value, mirroring the volume panels' look */
const CARD_CHART_FIELD_CONFIG: FieldConfigSource = {
  defaults: {
    unit: 'short',
    custom: { drawStyle: 'bars', fillOpacity: 100, lineWidth: 1, stacking: { mode: 'normal', group: 'A' } },
  },
  overrides: [],
};

interface FieldsBreakdownGridProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  range: TimeRange;
  /** Facet fields belonging to this tab (stream fields or other fields) */
  facets: FacetField[];
  /** All known field names of this tab — fields missing from `facets` are shown in the high-cardinality section */
  fallbackFieldNames: string[];
  facetsLoading: boolean;
  facetsError?: string;
  onSelectField: (field: string) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/**
 * Level-1 breakdown of a drill-in tab: one card per field with its facets summary
 * (top values + hits) and a lazily loaded per-value hits chart. Fields facets can't
 * summarize (too many unique values / too long values) get a chartless section,
 * const fields a compact one-line strip
 */
export const FieldsBreakdownGrid: React.FC<FieldsBreakdownGridProps> = ({
  datasource,
  query,
  range,
  facets,
  fallbackFieldNames,
  facetsLoading,
  facetsError,
  onSelectField,
  onChangeTimeRange,
}) => {
  const styles = useStyles2(getStyles);

  const [page, setPage] = useState(1);

  const { multiValue, constFields, otherFields } = useMemo(() => {
    const multi = facets
      .filter((f) => f.values.length > 1)
      // fewer distinct values first — low-cardinality fields discriminate best and read cleanest
      .sort((a, b) => a.values.length - b.values.length || a.name.localeCompare(b.name));
    const consts = facets.filter((f) => f.values.length === 1);
    const facetNames = new Set(facets.map((f) => f.name));
    const others = fallbackFieldNames.filter((name) => !facetNames.has(name)).sort();
    return { multiValue: multi, constFields: consts, otherFields: others };
  }, [facets, fallbackFieldNames]);

  const numberOfPages = Math.max(1, Math.ceil(multiValue.length / BREAKDOWN_PAGE_SIZE));
  // clamp when a refetch (filters/range changed) shrinks the card list below the current page
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage((prev) => Math.min(prev, numberOfPages));
  }, [numberOfPages]);

  if (facetsLoading && !facets.length) {
    return <LoadingPlaceholder text='Loading fields...' />;
  }

  if (!facetsError && !multiValue.length && !constFields.length && !otherFields.length) {
    return <EmptyState variant='not-found' message='No fields for the selected time range' />;
  }

  return (
    <div className={facetsLoading ? styles.refetching : undefined}>
      <Stack direction='column' gap={2}>
        {facetsError && (
          <Alert severity='warning' title='Field summaries unavailable'>
            {`${facetsError} — fields are listed without value summaries.`}
          </Alert>
        )}
        {multiValue.length > 0 && (
          <>
            <div className={styles.grid}>
              {multiValue.slice((page - 1) * BREAKDOWN_PAGE_SIZE, page * BREAKDOWN_PAGE_SIZE).map((facet) => (
                <FieldCard
                  key={facet.name}
                  facet={facet}
                  datasource={datasource}
                  query={query}
                  range={range}
                  onSelectField={onSelectField}
                  onChangeTimeRange={onChangeTimeRange}
                />
              ))}
            </div>
            <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={setPage} hideWhenSinglePage />
          </>
        )}
        {constFields.length > 0 && (
          <Stack direction='column' gap={0.5}>
            <Text variant='bodySmall' color='secondary'>
              Constant fields (same value in every log of this selection)
            </Text>
            <Stack direction='row' gap={1} wrap='wrap'>
              {constFields.map((facet) => (
                <span key={facet.name} className={styles.constChip}>
                  {`${facet.name}=${facet.values[0]?.value || '(empty)'}`}
                </span>
              ))}
            </Stack>
          </Stack>
        )}
        {otherFields.length > 0 && (
          <Stack direction='column' gap={0.5}>
            <Text variant='bodySmall' color='secondary'>
              Fields without a summary (too many unique values or too long values)
            </Text>
            <Stack direction='row' gap={1} wrap='wrap'>
              {otherFields.map((name) => (
                <Button key={name} size='sm' variant='secondary' fill='outline' onClick={() => onSelectField(name)}>
                  {name}
                </Button>
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>
    </div>
  );
};

interface FieldCardProps {
  facet: FacetField;
  datasource: VictoriaLogsDatasource;
  query: Query;
  range: TimeRange;
  onSelectField: (field: string) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/** One field card: clickable field title and a lazy per-value hits chart with the values legend below it */
const FieldCard: React.FC<FieldCardProps> = ({ facet, datasource, query, range, onSelectField, onChangeTimeRange }) => {
  const styles = useStyles2(getStyles);
  const [inViewRef, inView] = useInView();
  const [chartRef, chartWidth] = useElementWidth();
  const volumeData = useFieldVolume(datasource, query, facet.name, range, inView);
  const volumeHasSeries = volumeData.series.length > 0;

  // makes the bottom legend interactive: click isolates a value's series, ctrl/cmd+click appends
  const seriesLabels = useMemo(() => getSeriesLabels(volumeData), [volumeData]);
  const { panelContext, fieldConfig } = useLegendSeriesToggle(seriesLabels, CARD_CHART_FIELD_CONFIG);

  return (
    <div ref={inViewRef} className={styles.card}>
      <Stack direction='row' justifyContent='space-between' alignItems='baseline'>
        <Button
          fill='text'
          size='sm'
          onClick={() => onSelectField(facet.name)}
          tooltip={`Break down by ${facet.name}`}
        >
          {facet.name}
        </Button>
        <Text variant='bodySmall' color='secondary'>{`${facet.values.length} values`}</Text>
      </Stack>
      <div ref={chartRef} className={styles.cardBody}>
        {volumeData.state === LoadingState.Error && (
          <Alert severity='error' title='Failed to load field volume'>
            {volumeData.errors?.[0]?.message}
          </Alert>
        )}
        {(volumeData.state === LoadingState.Loading || volumeData.state === LoadingState.NotStarted) &&
          !volumeHasSeries && <LoadingPlaceholder text='Loading chart...' />}
        {volumeData.state === LoadingState.Done && !volumeHasSeries && <NoDataPlaceholder height={CARD_CHART_HEIGHT} />}
        {chartWidth > 0 && volumeHasSeries && (
          <div className={volumeData.state === LoadingState.Loading ? styles.refetching : undefined}>
            <PanelContextProvider value={panelContext}>
              <PanelRenderer
                pluginId='timeseries'
                title={facet.name}
                data={volumeData}
                width={chartWidth}
                height={CARD_CHART_HEIGHT}
                options={{
                  // the bottom legend replaces the old values list — one entry per value with its total
                  legend: { showLegend: true, displayMode: 'list', placement: 'bottom', calcs: ['sum'] },
                  tooltip: { mode: 'multi' },
                }}
                onChangeTimeRange={onChangeTimeRange}
                fieldConfig={fieldConfig}
              />
            </PanelContextProvider>
          </div>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
    gap: theme.spacing(1),
  }),
  card: css({
    padding: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  cardBody: css({
    marginTop: theme.spacing(0.5),
  }),
  constChip: css({
    padding: theme.spacing(0.25, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    overflowWrap: 'anywhere',
  }),
  // dims the content while a context-only refetch (range/filters/expr) is in flight, without unmounting it
  refetching: css({
    opacity: 0.6,
    transition: 'opacity 0.2s',
  }),
});
