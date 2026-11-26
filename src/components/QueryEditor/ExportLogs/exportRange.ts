import { getDefaultTimeRange, PanelData, TimeRange } from '@grafana/data';

/** The range of the last request comes first, so the file has the logs of the period that the panel shows */
export const resolveExportRange = (panelData?: PanelData, timeRange?: TimeRange): TimeRange =>
  panelData?.request?.range ?? timeRange ?? panelData?.timeRange ?? getDefaultTimeRange();
