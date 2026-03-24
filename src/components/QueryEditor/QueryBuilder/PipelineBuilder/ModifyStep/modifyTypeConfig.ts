import { escapeQuotes, RowSerializeResult } from '../serialization/types';
import CustomPipeEditor from '../shared/CustomPipeEditor';
import { BaseTypeDefinition, RowContentProps } from '../shared/types';

import EmptyContent from './parts/EmptyContent';
import ExtractEditor from './parts/ExtractEditor';
import FieldListEditor from './parts/FieldListEditor';
import FieldPairEditor from './parts/FieldPairEditor';
import FormatEditor from './parts/FormatEditor';
import PackEditor from './parts/PackEditor';
import ReplaceEditor from './parts/ReplaceEditor';
import UnpackEditor from './parts/UnpackEditor';
import { MODIFY_TYPE, ModifyRow, ModifyType } from './types';

export type ModifyRowContentProps = RowContentProps<ModifyRow>;

export type ModifyGroup = 'Field Manipulation' | 'Text Processing' | 'Data Serialization' | 'Utility';

export interface ModifyTypeDefinition extends BaseTypeDefinition<ModifyRow, ModifyRowContentProps> {
  group: ModifyGroup;
}

const serializeFieldPairs = (row: ModifyRow): RowSerializeResult => {
  const validPairs = (row.fieldPairs ?? []).filter((p) => p.src && p.dst);
  if (!validPairs.length) {
    return { result: '' };
  }
  const pairsStr = validPairs.map((p) => `${p.src} as ${p.dst}`).join(', ');
  return { result: `${row.modifyType} ${pairsStr}` };
};

const serializeFieldList = (row: ModifyRow): RowSerializeResult => {
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (!fields.length) {
    return { result: '' };
  }
  return { result: `${row.modifyType} ${fields.join(', ')}` };
};

const serializeReplace = (row: ModifyRow): RowSerializeResult => {
  if (!row.oldValue || !row.atField) {
    return { result: '' };
  }
  let result = `${row.modifyType} ("${escapeQuotes(row.oldValue)}", "${escapeQuotes(row.newValue ?? '')}") at ${row.atField}`;
  if (row.limit) {
    result += ` limit ${row.limit}`;
  }
  return { result };
};

const serializeExtract = (row: ModifyRow): RowSerializeResult => {
  if (!row.pattern || !row.fromField) {
    return { result: '' };
  }
  return { result: `${row.modifyType} "${escapeQuotes(row.pattern)}" from ${row.fromField}` };
};

const serializePack = (row: ModifyRow): RowSerializeResult => {
  let result = row.modifyType;
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (fields.length) {
    result += ` fields (${fields.join(', ')})`;
  }
  if (row.resultField) {
    result += ` as ${row.resultField}`;
  }
  return { result };
};

const serializeUnpack = (row: ModifyRow): RowSerializeResult => {
  if (!row.fromField) {
    return { result: '' };
  }
  let result = `${row.modifyType} from ${row.fromField}`;
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (fields.length) {
    result += ` fields (${fields.join(', ')})`;
  }
  if (row.resultPrefix) {
    result += ` result_prefix ${row.resultPrefix}`;
  }
  return { result };
};

const MODIFY_TYPE_CONFIG: Record<ModifyType, ModifyTypeDefinition> = {
  [MODIFY_TYPE.Rename]: {
    label: 'rename',
    description: 'Renames a field to a new name',
    group: 'Field Manipulation',
    ContentComponent: FieldPairEditor,
    serialize: serializeFieldPairs,
    createInitialRow: () => ({ fieldPairs: [{ src: '', dst: '' }] }),
  },
  [MODIFY_TYPE.Delete]: {
    label: 'delete',
    description: 'Removes specified fields from log entries',
    group: 'Field Manipulation',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
    createInitialRow: () => ({ fieldList: [] }),
  },
  [MODIFY_TYPE.Copy]: {
    label: 'copy',
    description: 'Copies field value to a new field',
    group: 'Field Manipulation',
    ContentComponent: FieldPairEditor,
    serialize: serializeFieldPairs,
    createInitialRow: () => ({ fieldPairs: [{ src: '', dst: '' }] }),
  },
  [MODIFY_TYPE.Keep]: {
    label: 'keep',
    description: 'Keeps only specified fields, removing all others',
    group: 'Field Manipulation',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
    createInitialRow: () => ({ fieldList: [] }),
  },
  [MODIFY_TYPE.Replace]: {
    label: 'replace',
    description: 'Replaces exact text matches in field values',
    group: 'Text Processing',
    ContentComponent: ReplaceEditor,
    serialize: serializeReplace,
    createInitialRow: () => ({ atField: '_msg' }),
  },
  [MODIFY_TYPE.ReplaceRegexp]: {
    label: 'replace_regexp',
    description: 'Replaces text using regular expression patterns',
    group: 'Text Processing',
    ContentComponent: ReplaceEditor,
    serialize: serializeReplace,
    createInitialRow: () => ({ atField: '_msg' }),
  },
  [MODIFY_TYPE.Extract]: {
    label: 'extract',
    description: 'Extracts substrings using a pattern into new fields',
    group: 'Text Processing',
    ContentComponent: ExtractEditor,
    serialize: serializeExtract,
    createInitialRow: () => ({ fromField: '_msg' }),
  },
  [MODIFY_TYPE.ExtractRegexp]: {
    label: 'extract_regexp',
    description: 'Extracts substrings using regular expressions with named capture groups',
    group: 'Text Processing',
    ContentComponent: ExtractEditor,
    serialize: serializeExtract,
    createInitialRow: () => ({ fromField: '_msg' }),
  },
  [MODIFY_TYPE.Format]: {
    label: 'format',
    description: 'Creates a new field using a format string with field placeholders',
    group: 'Text Processing',
    ContentComponent: FormatEditor,
    serialize: (row) => {
      if (!row.formatString || !row.resultField) {
        return { result: '' };
      }
      return { result: `format "${escapeQuotes(row.formatString)}" as ${row.resultField}` };
    },
    createInitialRow: () => ({}),
  },
  [MODIFY_TYPE.PackJson]: {
    label: 'pack_json',
    description: 'Packs specified fields into a JSON object',
    group: 'Data Serialization',
    ContentComponent: PackEditor,
    serialize: serializePack,
    createInitialRow: () => ({}),
  },
  [MODIFY_TYPE.PackLogfmt]: {
    label: 'pack_logfmt',
    description: 'Packs specified fields into logfmt format',
    group: 'Data Serialization',
    ContentComponent: PackEditor,
    serialize: serializePack,
    createInitialRow: () => ({}),
  },
  [MODIFY_TYPE.UnpackJson]: {
    label: 'unpack_json',
    description: 'Unpacks JSON field into separate fields',
    group: 'Data Serialization',
    ContentComponent: UnpackEditor,
    serialize: serializeUnpack,
    createInitialRow: () => ({ fromField: '_msg' }),
  },
  [MODIFY_TYPE.UnpackLogfmt]: {
    label: 'unpack_logfmt',
    description: 'Unpacks logfmt field into separate fields',
    group: 'Data Serialization',
    ContentComponent: UnpackEditor,
    serialize: serializeUnpack,
    createInitialRow: () => ({ fromField: '_msg' }),
  },
  [MODIFY_TYPE.DropEmptyFields]: {
    label: 'drop_empty_fields',
    description: 'Removes all fields with empty values',
    group: 'Utility',
    ContentComponent: EmptyContent,
    serialize: () => ({ result: 'drop_empty_fields' }),
    createInitialRow: () => ({}),
  },
  [MODIFY_TYPE.CustomPipe]: {
    label: 'Custom',
    description: 'Add a raw pipe expression',
    group: 'Utility',
    ContentComponent: CustomPipeEditor,
    serialize: (row) => ({ result: row.expression ?? '' }),
    createInitialRow: () => ({}),
  },
};

export default MODIFY_TYPE_CONFIG;

const MODIFY_GROUPS: ModifyGroup[] = ['Field Manipulation', 'Text Processing', 'Data Serialization', 'Utility'];

export const MODIFY_TYPE_GROUPED_ENTRIES = MODIFY_GROUPS.map((group) => ({
  group,
  entries: Object.entries(MODIFY_TYPE_CONFIG)
    .filter(([key, config]) => config.group === group && key !== MODIFY_TYPE.CustomPipe)
    .map(([modifyType, config]) => ({
      modifyType: modifyType as ModifyType,
      label: config.label,
      description: config.description,
    })),
}));
