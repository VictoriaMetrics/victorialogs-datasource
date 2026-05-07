import { Segment } from '../types';

export interface OptionalExtension {
  key: string;
  label: string;
  createSegments: () => Segment[];
  /** When set, segments are inserted at this index instead of appended. */
  insertionIndex?: number;
  /** When true, extension is added automatically when the pipe is created. */
  addByDefault?: boolean;
}

export interface TemplateConfig {
  type: string;
  label: string;
  description?: string;
  group?: string;
  stepCategory: 'stream' | 'filter' | 'modify' | 'aggregate' | 'aggregateFilter' | 'aggregateModify' | 'aggregateModifyFilter' | 'sort' | 'limit' | 'custom';
  createSegments: () => Segment[];
  tabOrder: (segments: Segment[]) => string[];
  optionalExtensions?: OptionalExtension[];
}
