import React from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { MODIFY_TYPE, ModifyRow, ModifyType } from '../types';

import EmptyContent from './parts/EmptyContent';
import ExtractEditor from './parts/ExtractEditor';
import FieldListEditor from './parts/FieldListEditor';
import FieldPairEditor from './parts/FieldPairEditor';
import FormatEditor from './parts/FormatEditor';
import PackEditor from './parts/PackEditor';
import ReplaceEditor from './parts/ReplaceEditor';
import UnpackEditor from './parts/UnpackEditor';

export interface ModifyRowContentProps {
  row: ModifyRow;
  onChange: (updatedRow: ModifyRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
}

export type ModifyGroup = 'Field Manipulation' | 'Text Processing' | 'Data Serialization' | 'Utility';

export interface ModifyTypeDefinition {
  label: string;
  description: string;
  group: ModifyGroup;
  ContentComponent: React.FC<ModifyRowContentProps>;
}

const MODIFY_TYPE_CONFIG: Record<ModifyType, ModifyTypeDefinition> = {
  [MODIFY_TYPE.Rename]: {
    label: 'rename',
    description: 'Renames a field to a new name',
    group: 'Field Manipulation',
    ContentComponent: FieldPairEditor,
  },
  [MODIFY_TYPE.Delete]: {
    label: 'delete',
    description: 'Removes specified fields from log entries',
    group: 'Field Manipulation',
    ContentComponent: FieldListEditor,
  },
  [MODIFY_TYPE.Copy]: {
    label: 'copy',
    description: 'Copies field value to a new field',
    group: 'Field Manipulation',
    ContentComponent: FieldPairEditor,
  },
  [MODIFY_TYPE.Fields]: {
    label: 'fields',
    description: 'Keeps only specified fields, removing all others',
    group: 'Field Manipulation',
    ContentComponent: FieldListEditor,
  },
  [MODIFY_TYPE.Replace]: {
    label: 'replace',
    description: 'Replaces exact text matches in field values',
    group: 'Text Processing',
    ContentComponent: ReplaceEditor,
  },
  [MODIFY_TYPE.ReplaceRegexp]: {
    label: 'replace_regexp',
    description: 'Replaces text using regular expression patterns',
    group: 'Text Processing',
    ContentComponent: ReplaceEditor,
  },
  [MODIFY_TYPE.Extract]: {
    label: 'extract',
    description: 'Extracts substrings using a pattern into new fields',
    group: 'Text Processing',
    ContentComponent: ExtractEditor,
  },
  [MODIFY_TYPE.ExtractRegexp]: {
    label: 'extract_regexp',
    description: 'Extracts substrings using regular expressions with named capture groups',
    group: 'Text Processing',
    ContentComponent: ExtractEditor,
  },
  [MODIFY_TYPE.Format]: {
    label: 'format',
    description: 'Creates a new field using a format string with field placeholders',
    group: 'Text Processing',
    ContentComponent: FormatEditor,
  },
  [MODIFY_TYPE.PackJson]: {
    label: 'pack_json',
    description: 'Packs specified fields into a JSON object',
    group: 'Data Serialization',
    ContentComponent: PackEditor,
  },
  [MODIFY_TYPE.PackLogfmt]: {
    label: 'pack_logfmt',
    description: 'Packs specified fields into logfmt format',
    group: 'Data Serialization',
    ContentComponent: PackEditor,
  },
  [MODIFY_TYPE.UnpackJson]: {
    label: 'unpack_json',
    description: 'Unpacks JSON field into separate fields',
    group: 'Data Serialization',
    ContentComponent: UnpackEditor,
  },
  [MODIFY_TYPE.UnpackLogfmt]: {
    label: 'unpack_logfmt',
    description: 'Unpacks logfmt field into separate fields',
    group: 'Data Serialization',
    ContentComponent: UnpackEditor,
  },
  [MODIFY_TYPE.DropEmptyFields]: {
    label: 'drop_empty_fields',
    description: 'Removes all fields with empty values',
    group: 'Utility',
    ContentComponent: EmptyContent as React.FC<ModifyRowContentProps>,
  },
};

export default MODIFY_TYPE_CONFIG;

const MODIFY_GROUPS: ModifyGroup[] = ['Field Manipulation', 'Text Processing', 'Data Serialization', 'Utility'];

export const MODIFY_TYPE_GROUPED_ENTRIES = MODIFY_GROUPS.map((group) => ({
  group,
  entries: Object.entries(MODIFY_TYPE_CONFIG)
    .filter(([, config]) => config.group === group)
    .map(([modifyType, config]) => ({
      modifyType: modifyType as ModifyType,
      label: config.label,
      description: config.description,
    })),
}));
