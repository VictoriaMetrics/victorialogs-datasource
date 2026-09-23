import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { AbsoluteTimeRange, GrafanaTheme2, LoadingState, TimeRange } from '@grafana/data';
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
import { ConstantFieldsStrip } from '../shared/ConstantFieldsStrip';
import { NoDataPlaceholder } from '../shared/NoDataPlaceholder';
import { STACKED_BARS_CHART_FIELD_CONFIG } from '../shared/levelVolume';
import { useElementWidth } from '../shared/useElementWidth';
import { useInView } from '../shared/useInView';
import { getSeriesLabels, useLegendSeriesToggle } from '../shared/useLegendSeriesToggle';
import { useDrilldownTimeZone } from '../timeZoneContext';

// tall enough to include the bottom legend that lists the values with their sums
const CARD_CHART_HEIGHT = 220;

interface FieldsBreakdownGridProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  range: TimeRange;
  /** The facet fields of this tab */
  facets: FacetField[];
  /** Every known field name of this tab. A field missing from `facets` lands in the no-summary section */
  fallbackFieldNames: string[];
  facetsLoading: boolean;
  /** The value summaries failed to load: the fields are still listed, without summaries */
  facetsError?: string;
  /** The tab's field list itself failed to load, so there is nothing to list */
  fieldsError?: string;
  /** Plural noun for the loading and empty texts: "fields", "stream fields" */
  noun?: string;
  onSelectField: (field: string) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/**
 * One card per field, each showing the field's top values with their hits and a hits chart
 * that loads when the card scrolls into view. A field the facets endpoint could not summarize
 * gets a chartless section, and a field with a single value gets a one-line strip
 */
export const FieldsBreakdownGrid: React.FC<FieldsBreakdownGridProps> = ({
  datasource,
  query,
  range,
  facets,
  fallbackFieldNames,
  facetsLoading,
  facetsError,
  fieldsError,
  noun = 'fields',
  onSelectField,
  onChangeTimeRange,
}) => {
  const styles = useStyles2(getStyles);

  const [page, setPage] = useState(1);

  const { multiValue, constFields, otherFields } = useMemo(() => {
    const multi = facets
      .filter((f) => f.values.length > 1)
      // fields with fewer distinct values come first, because they separate the logs best
      .sort((a, b) => a.values.length - b.values.length || a.name.localeCompare(b.name));
    const consts = facets
      .filter((f) => f.values.length === 1)
      .map((f) => ({ name: f.name, value: f.values[0].value }));
    // a facet without values has nothing to summarize, so it falls through to the chartless list
    const facetNames = new Set(facets.filter((f) => f.values.length >= 1).map((f) => f.name));
    const others = fallbackFieldNames.filter((name) => !facetNames.has(name)).sort();
    return { multiValue: multi, constFields: consts, otherFields: others };
  }, [facets, fallbackFieldNames]);

  const numberOfPages = Math.max(1, Math.ceil(multiValue.length / BREAKDOWN_PAGE_SIZE));
  // clamp the page when a refetch shrinks the card list below the current page
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage((prev) => Math.min(prev, numberOfPages));
  }, [numberOfPages]);

  if (facetsLoading && !facets.length) {
    return <LoadingPlaceholder text={`Loading ${noun}...`} />;
  }

  if (fieldsError) {
    return (
      <Alert severity='error' title={`Failed to load ${noun}`}>
        {fieldsError}
      </Alert>
    );
  }

  if (!facetsError && !multiValue.length && !constFields.length && !otherFields.length) {
    return <EmptyState variant='not-found' message={`No ${noun} for the selected time range`} />;
  }

  return (
    <div className={facetsLoading ? styles.refetching : undefined}>
      <Stack direction='column' gap={2}>
        {facetsError && (
          <Alert severity='warning' title='Field summaries unavailable'>
            {`${facetsError} — ${noun} are listed without value summaries.`}
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
        <ConstantFieldsStrip fields={constFields} />
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

/** One field card: a clickable title and a hits chart with the values legend below it */
const FieldCard: React.FC<FieldCardProps> = ({ facet, datasource, query, range, onSelectField, onChangeTimeRange }) => {
  const styles = useStyles2(getStyles);
  const [inViewRef, inView] = useInView();
  const [chartRef, chartWidth] = useElementWidth();
  const timeZone = useDrilldownTimeZone();
  const volumeData = useFieldVolume(datasource, query, facet.name, range, inView);
  const volumeHasSeries = volumeData.series.length > 0;

  // makes the bottom legend interactive: a click isolates a value, ctrl or cmd click adds one
  const seriesLabels = useMemo(() => getSeriesLabels(volumeData), [volumeData]);
  const { panelContext, fieldConfig } = useLegendSeriesToggle(seriesLabels, STACKED_BARS_CHART_FIELD_CONFIG);

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
                timeZone={timeZone}
                options={{
                  // the legend doubles as the values list, one entry per value with its total
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
  // dims the content while a refetch runs, instead of unmounting it
  refetching: css({
    opacity: 0.6,
    transition: 'opacity 0.2s',
  }),
});
