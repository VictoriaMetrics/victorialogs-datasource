import { DataFrame, FieldConfigSource, LoadingState, LogLevel, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { aggregateRawLogsVolume, extractLevel, getUniformVolumeTimeAxis } from '../../../../logsVolumeLegacy';
import { buildLevelGrouping, LevelGrouping } from '../../../../utils/query/levelFormatPipes';
import { DRILLDOWN_ROW_BARS, getDrilldownLevelRules } from '../queries/drilldownQueries';

import { TransformedVolume } from './BreakdownTable';

export const STACKED_BARS_CHART_FIELD_CONFIG: FieldConfigSource = {
  defaults: {
    unit: 'short',
    custom: { drawStyle: 'bars', fillOpacity: 100, lineWidth: 1, stacking: { mode: 'normal', group: 'A' } },
  },
  overrides: [],
};

/** The same server-side level derivation the main logs-volume panel uses */
export function getLevelGrouping(datasource: VictoriaLogsDatasource): LevelGrouping {
  return buildLevelGrouping(datasource.getActiveLevelRules());
}

/**
 * Derives a breakdown row's two charts from its raw volume frames. The sparkline keeps one
 * colored series per level, and the aggregation already applies the bar styling and stacking,
 * so those frames render as they are. The top chart sums the levels back into a single series
 * per row
 */
export function transformLevelVolume(
  datasource: VictoriaLogsDatasource,
  frames: DataFrame[],
  range: TimeRange
): TransformedVolume {
  const times = getUniformVolumeTimeAxis(range, DRILLDOWN_ROW_BARS);
  const perLevel = aggregateRawLogsVolume(frames, extractLevel, times, getDrilldownLevelRules(datasource));
  const summed = aggregateRawLogsVolume(frames, () => LogLevel.unknown, times, []).map(
    (frame) => ({
      ...frame,
      // drop the grey "unknown" level styling so the top chart assigns a palette color
      fields: frame.fields.map((f) => ({ ...f, config: {} })),
    })
  );
  return { sparkline: { series: perLevel, state: LoadingState.Done, timeRange: range }, topSeries: summed };
}
