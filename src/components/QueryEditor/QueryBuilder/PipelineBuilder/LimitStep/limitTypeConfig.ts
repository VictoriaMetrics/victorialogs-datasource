import { RowSerializeResult } from '../serialization/types';
import CustomPipeEditor from '../shared/CustomPipeEditor';
import { BaseTypeDefinition, RowContentProps } from '../shared/types';

import NumberEditor from './parts/NumberEditor';
import NumberWithFieldsEditor from './parts/NumberWithFieldsEditor';
import { LIMIT_TYPE, LimitRow, LimitType } from './types';

export type LimitRowContentProps = RowContentProps<LimitRow>;

export type LimitGroup = 'Basic' | 'Selection';

export interface LimitTypeDefinition extends BaseTypeDefinition<LimitRow, LimitRowContentProps> {
  group: LimitGroup;
}

const serializeNumber = (row: LimitRow, _stepId: string): RowSerializeResult => {
  if (!row.count) {
    return { result: '' };
  }
  return { result: `${row.limitType} ${row.count}` };
};

const serializeNumberWithFields = (row: LimitRow, _stepId: string): RowSerializeResult => {
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (!row.count || !fields.length) {
    return { result: '' };
  }
  let result = `${row.limitType} ${row.count} by (${fields.join(', ')})`;
  const partitionFields = (row.partitionByFields ?? []).filter(Boolean);
  if (partitionFields.length) {
    result += ` partition by (${partitionFields.join(', ')})`;
  }
  return { result };
};

const LIMIT_TYPE_CONFIG: Record<LimitType, LimitTypeDefinition> = {
  [LIMIT_TYPE.Limit]: {
    label: 'limit',
    description: 'Limits the number of returned entries',
    group: 'Basic',
    ContentComponent: NumberEditor,
    serialize: serializeNumber,
    createInitialRow: () => ({ count: '10' }),
  },
  [LIMIT_TYPE.Offset]: {
    label: 'offset',
    description: 'Skips the specified number of entries',
    group: 'Basic',
    ContentComponent: NumberEditor,
    serialize: serializeNumber,
    createInitialRow: () => ({}),
  },
  [LIMIT_TYPE.First]: {
    label: 'first',
    description: 'Returns first N entries after sorting by fields',
    group: 'Selection',
    ContentComponent: NumberWithFieldsEditor,
    serialize: serializeNumberWithFields,
    createInitialRow: () => ({}),
  },
  [LIMIT_TYPE.Last]: {
    label: 'last',
    description: 'Returns last N entries after sorting by fields',
    group: 'Selection',
    ContentComponent: NumberWithFieldsEditor,
    serialize: serializeNumberWithFields,
    createInitialRow: () => ({}),
  },
  [LIMIT_TYPE.Top]: {
    label: 'top',
    description: 'Returns top N values with maximum count',
    group: 'Selection',
    ContentComponent: NumberWithFieldsEditor,
    serialize: serializeNumberWithFields,
    createInitialRow: () => ({}),
  },
  [LIMIT_TYPE.CustomPipe]: {
    label: 'Custom',
    description: 'Add a raw pipe expression',
    group: 'Basic',
    ContentComponent: CustomPipeEditor,
    serialize: (row) => ({ result: row.expression ?? '' }),
    createInitialRow: () => ({}),
  },
};

export default LIMIT_TYPE_CONFIG;

const LIMIT_GROUPS: LimitGroup[] = ['Basic', 'Selection'];

export const LIMIT_TYPE_GROUPED_ENTRIES = LIMIT_GROUPS.map((group) => ({
  group,
  entries: Object.entries(LIMIT_TYPE_CONFIG)
    .filter(([key, config]) => config.group === group && key !== LIMIT_TYPE.CustomPipe)
    .map(([limitType, config]) => ({
      limitType: limitType as LimitType,
      label: config.label,
      description: config.description,
    })),
}));
