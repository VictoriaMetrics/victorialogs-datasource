import React from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../../datasource';

import NumberEditor from './parts/NumberEditor';
import NumberWithFieldsEditor from './parts/NumberWithFieldsEditor';
import { LIMIT_TYPE, LimitRow, LimitType } from './types';

export interface LimitRowContentProps {
  row: LimitRow;
  onChange: (updatedRow: LimitRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
}

export type LimitGroup = 'Basic' | 'Selection';

export interface LimitTypeDefinition {
  label: string;
  description: string;
  group: LimitGroup;
  ContentComponent: React.FC<LimitRowContentProps>;
}

const LIMIT_TYPE_CONFIG: Record<LimitType, LimitTypeDefinition> = {
  [LIMIT_TYPE.Limit]: {
    label: 'limit',
    description: 'Limits the number of returned entries',
    group: 'Basic',
    ContentComponent: NumberEditor,
  },
  [LIMIT_TYPE.Offset]: {
    label: 'offset',
    description: 'Skips the specified number of entries',
    group: 'Basic',
    ContentComponent: NumberEditor,
  },
  [LIMIT_TYPE.First]: {
    label: 'first',
    description: 'Returns first N entries after sorting by fields',
    group: 'Selection',
    ContentComponent: NumberWithFieldsEditor,
  },
  [LIMIT_TYPE.Last]: {
    label: 'last',
    description: 'Returns last N entries after sorting by fields',
    group: 'Selection',
    ContentComponent: NumberWithFieldsEditor,
  },
  [LIMIT_TYPE.Top]: {
    label: 'top',
    description: 'Returns top N values with maximum count',
    group: 'Selection',
    ContentComponent: NumberWithFieldsEditor,
  },
};

export default LIMIT_TYPE_CONFIG;

const LIMIT_GROUPS: LimitGroup[] = ['Basic', 'Selection'];

export const LIMIT_TYPE_GROUPED_ENTRIES = LIMIT_GROUPS.map((group) => ({
  group,
  entries: Object.entries(LIMIT_TYPE_CONFIG)
    .filter(([, config]) => config.group === group)
    .map(([limitType, config]) => ({
      limitType: limitType as LimitType,
      label: config.label,
      description: config.description,
    })),
}));
