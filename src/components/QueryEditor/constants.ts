export const EXPLORE_GRAPH_STYLES = {
  LINES: 'lines',
  BARS: 'bars',
  POINTS: 'points',
  STACKED_LINES: 'stacked_lines',
  STACKED_BARS: 'stacked_bars'
} as const;
export type EXPLORE_STYLE_GRAPH_STYLE = typeof EXPLORE_GRAPH_STYLES[keyof typeof EXPLORE_GRAPH_STYLES];

export const DEFAULT_QUERY_EXPR = '*';
