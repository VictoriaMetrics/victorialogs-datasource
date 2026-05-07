import { getTabOrder, placeholder, uniqueId } from '../segmentHelpers';

import { TemplateConfig } from './types';

export const CUSTOM_TEMPLATE: TemplateConfig = {
  type: 'custom',
  label: 'Custom',
  stepCategory: 'custom',
  createSegments: () => [
    placeholder(uniqueId('expr'), { role: 'expression', displayHint: 'LogsQL expression', optionSource: 'freeText' }),
  ],
  tabOrder: getTabOrder,
};
