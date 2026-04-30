import { getTabOrder, placeholder, text, uniqueId } from '../segmentHelpers';

import { packExtensions } from './extensions';
import { TemplateConfig } from './types';

export const AGGREGATE_MODIFY_TEMPLATES: TemplateConfig[] = [
  {
    type: 'agg_math',
    label: 'Math',
    stepCategory: 'aggregateModify',
    createSegments: () => [
      text('math '),
      placeholder(uniqueId('expr'), { role: 'expression', displayHint: 'expression', optionSource: 'freeText' }),
      text(' as '),
      placeholder(uniqueId('result'), { role: 'expression', displayHint: 'result_name', optionSource: 'freeText' }),
    ],
    tabOrder: getTabOrder,
  },
  {
    type: 'agg_format',
    label: 'Format',
    stepCategory: 'aggregateModify',
    createSegments: () => [
      text('format "'),
      placeholder(uniqueId('fmt'), { role: 'expression', displayHint: 'format_string', optionSource: 'freeText' }),
      text('" as '),
      placeholder(uniqueId('result'), { role: 'expression', displayHint: 'result_name', optionSource: 'freeText' }),
    ],
    tabOrder: getTabOrder,
  },
  {
    type: 'agg_pack_json',
    label: 'Pack JSON',
    stepCategory: 'aggregateModify',
    createSegments: () => [text('pack_json')],
    tabOrder: () => [],
    optionalExtensions: packExtensions,
  },
];
