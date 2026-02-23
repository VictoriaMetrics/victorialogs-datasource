export const ANNOTATIONS_REF_ID = 'Anno';

export enum FrameField {
  Labels = 'labels',
  Line = 'Line',
  /**
   * The name of the label that is added to the log line to indicate the calculated log level according to the log level rules
   * Grafana supports only `detected_level` and `level` label names. Apps often use 'level' for the log level,
   * so to avoid duplication and confusion of overwritten 'level' labels, we use 'detected_level' instead.
   * */
  DetectedLevel = 'detected_level'
}

export interface ParsedBucket {
  yMin: number;
  yMax: number;
  timestamps: number[];
  values: Array<number | null>;
}
