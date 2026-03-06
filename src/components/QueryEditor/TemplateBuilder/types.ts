import { ComboboxOption } from '@grafana/ui';

export type SegmentRole =
  | 'fieldName'
  | 'fieldValue'
  | 'streamFieldName'
  | 'streamFieldValue'
  | 'operator'
  | 'number'
  | 'text'
  | 'direction'
  | 'pattern'
  | 'expression';

export type SegmentOptionSource = 'fieldNames' | 'fieldValues' | 'streamFieldNames' | 'streamFieldValues' | 'fieldNamesWithStream' | 'static' | 'freeText';

export interface TextSegment {
  type: 'text';
  value: string;
}

export interface PlaceholderSegment {
  type: 'placeholder';
  id: string;
  role: SegmentRole;
  value: string | null;
  displayHint: string;
  optionSource: SegmentOptionSource;
  staticOptions?: ComboboxOption[];
  multi?: boolean;
  multiValues?: string[];
  dependsOn?: string;
  excludeOptions?: string[];
}

export type Segment = TextSegment | PlaceholderSegment;

export interface Pipe {
  id: string;
  templateType: string;
  segments: Segment[];
  tabOrder: string[];
  activeExtensionKeys?: string[];
}

export interface TemplateQueryModel {
  pipes: Pipe[];
}
