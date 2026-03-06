import { DataFrame } from '@grafana/data';

import { processHistogramToHeatmap } from './heatmapProcessor';
import { processHistogramToNativeHistogram } from './histogramProcessor';

/**
 * Selects the appropriate histogram transformation based on panel type.
 *
 * - For "barchart" panel: produces wide-format DataFrame (Bucket + series columns)
 * - For "histogram" panel: produces native Histogram format (xMin, xMax, count fields)
 * - For "heatmap" panel: produces HeatmapCells format
 * - For all other panels: returns original frames
 */
export function processHistogramFrames(frames: DataFrame[], panelPluginId?: string): DataFrame[] {
  switch (panelPluginId) {
    case 'histogram':
      return processHistogramToNativeHistogram(frames);
    case 'heatmap':
      return processHistogramToHeatmap(frames);
    default:
      return frames;
  }
}
