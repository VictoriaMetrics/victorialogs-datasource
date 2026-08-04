import { DataFrame, FieldConfigSource, LoadingState, LogLevel, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { aggregateRawLogsVolume, extractLevel } from '../../../../logsVolumeLegacy';
import { buildLevelGrouping, LevelGrouping } from '../../../../utils/query/levelFormatPipes';
import { buildDrilldownRequest, DRILLDOWN_ROW_BARS } from '../queries/drilldownQueries';

import { TransformedVolume } from './BreakdownTable';

/** Stacked-bars styling for a breakdown top chart — one series per row, mirroring the drawer's volume panels */
export const STACKED_BARS_CHART_FIELD_CONFIG: FieldConfigSource = {
  defaults: {
    unit: 'short',
    custom: { drawStyle: 'bars', fillOpacity: 100, lineWidth: 1, stacking: { mode: 'normal', group: 'A' } },
  },
  overrides: [],
};

/** Level-splitting recipe of a row's volume query — same server-side derivation as the main logs-volume panel */
export function getLevelGrouping(datasource: VictoriaLogsDatasource): LevelGrouping {
  return buildLevelGrouping(datasource.getActiveLevelRules());
}

/**
 * Derives a breakdown row's charts from its raw volume frames.
 * Sparkline: level-stacked colored series, same pipeline as the drill-in volume chart;
 * top chart: the levels summed back into one series per row (its palette color survives
 * because the level-fixed colors are stripped)
 */
export function transformLevelVolume(
  datasource: VictoriaLogsDatasource,
  frames: DataFrame[],
  range: TimeRange
): TransformedVolume {
  const request = buildDrilldownRequest([], range, 'drilldown-value-volume-aggregate');
  // level-stacked bars: the aggregation's per-level frames already carry the bar styling,
  // colors and stacking used by the drawer's volume panels — render them as-is
  const perLevel = aggregateRawLogsVolume(frames, extractLevel, request, datasource.logLevelRules, DRILLDOWN_ROW_BARS);
  const summed = aggregateRawLogsVolume(frames, () => LogLevel.unknown, request, [], DRILLDOWN_ROW_BARS).map(
    (frame) => ({
      ...frame,
      // drop the level styling (grey "unknown") so the top chart assigns palette colors
      fields: frame.fields.map((f) => ({ ...f, config: {} })),
    })
  );
  return { sparkline: { series: perLevel, state: LoadingState.Done, timeRange: range }, topSeries: summed };
}
