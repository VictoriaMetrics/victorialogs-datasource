import { getTabOrder, placeholder, text, uniqueId } from '../segmentHelpers';

import { statsExtensions } from './extensions';
import { TemplateConfig } from './types';

const noArgStats = (type: string, label: string, funcName: string): TemplateConfig => ({
  type: `stats_${type}`,
  label,
  stepCategory: 'aggregate',
  createSegments: () => [text('stats '), text(`${funcName}()`)],
  tabOrder: () => [],
  optionalExtensions: statsExtensions,
});

const fieldArgStats = (type: string, label: string, funcName: string): TemplateConfig => ({
  type: `stats_${type}`,
  label,
  stepCategory: 'aggregate',
  createSegments: () => [
    text('stats '),
    text(`${funcName}(`),
    placeholder(uniqueId('fields'), { role: 'fieldName', displayHint: 'fields', optionSource: 'fieldNames', multi: true }),
    text(')'),
  ],
  tabOrder: getTabOrder,
  optionalExtensions: statsExtensions,
});

export const AGGREGATE_TEMPLATES: TemplateConfig[] = [
  noArgStats('count', 'Count', 'count'),
  fieldArgStats('sum', 'Sum', 'sum'),
  fieldArgStats('avg', 'Avg', 'avg'),
  fieldArgStats('min', 'Min', 'min'),
  fieldArgStats('max', 'Max', 'max'),
  fieldArgStats('median', 'Median', 'median'),
  {
    type: 'stats_quantile',
    label: 'Quantile',
    stepCategory: 'aggregate',
    createSegments: () => [
      text('stats '),
      text('quantile('),
      placeholder(uniqueId('phi'), { role: 'number', displayHint: '0.95', optionSource: 'freeText' }),
      text(', '),
      placeholder(uniqueId('fields'), { role: 'fieldName', displayHint: 'fields', optionSource: 'fieldNames', multi: true }),
      text(')'),
    ],
    tabOrder: getTabOrder,
    optionalExtensions: statsExtensions,
  },
  noArgStats('rate', 'Rate', 'rate'),
  {
    type: 'stats_histogram',
    label: 'Histogram',
    stepCategory: 'aggregate',
    createSegments: () => [
      text('stats '),
      text('histogram('),
      placeholder(uniqueId('field'), { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
      text(')'),
    ],
    tabOrder: getTabOrder,
    optionalExtensions: statsExtensions,
  },
];
