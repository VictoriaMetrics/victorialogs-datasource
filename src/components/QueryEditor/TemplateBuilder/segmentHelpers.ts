import { ComboboxOption } from '@grafana/ui';

export const STREAM_TEMPLATE_TYPE = 'stream';

import {
  PlaceholderSegment,
  SegmentOptionSource,
  SegmentRole,
  TextSegment,
} from './types';

export const text = (value: string): TextSegment => ({
  type: 'text',
  value,
});

interface PlaceholderOptions {
  role: SegmentRole;
  displayHint: string;
  optionSource: SegmentOptionSource;
  staticOptions?: ComboboxOption[];
  multi?: boolean;
  dependsOn?: string;
  excludeOptions?: string[];
  /** Pre-selected default value (shown without user interaction) */
  defaultValue?: string;
}

export const placeholder = (id: string, opts: PlaceholderOptions): PlaceholderSegment => ({
  type: 'placeholder',
  id,
  role: opts.role,
  value: opts.defaultValue ?? null,
  displayHint: opts.displayHint,
  optionSource: opts.optionSource,
  staticOptions: opts.staticOptions,
  multi: opts.multi,
  multiValues: undefined,
  dependsOn: opts.dependsOn,
  excludeOptions: opts.excludeOptions,
});

let counter = 0;
export const uniqueId = (prefix: string): string => `${prefix}-${Date.now()}-${counter++}`;

export const getTabOrder = (segments: (TextSegment | PlaceholderSegment)[]): string[] =>
  segments.filter((s): s is PlaceholderSegment => s.type === 'placeholder').map((s) => s.id);
