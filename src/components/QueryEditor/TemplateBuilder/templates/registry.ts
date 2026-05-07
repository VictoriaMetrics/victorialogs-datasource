import { AGGREGATE_MODIFY_TEMPLATES } from './aggregateModifyTemplates';
import { AGGREGATE_TEMPLATES } from './aggregateTemplates';
import { CUSTOM_TEMPLATE } from './customTemplate';
import { FILTER_TEMPLATES, STREAM_TEMPLATE } from './filterTemplates';
import { LIMIT_TEMPLATES } from './limitTemplates';
import { MODIFY_TEMPLATES } from './modifyTemplates';
import { SORT_TEMPLATE } from './sortTemplate';
import { TemplateConfig } from './types';

export const ALL_TEMPLATES: TemplateConfig[] = [
  STREAM_TEMPLATE,
  ...FILTER_TEMPLATES,
  ...MODIFY_TEMPLATES,
  ...AGGREGATE_TEMPLATES,
  SORT_TEMPLATE,
  ...LIMIT_TEMPLATES,
  CUSTOM_TEMPLATE,
  ...AGGREGATE_MODIFY_TEMPLATES,
];

const templateMap = new Map<string, TemplateConfig>(
  ALL_TEMPLATES.map((t) => [t.type, t])
);

export const getTemplate = (type: string): TemplateConfig | undefined => templateMap.get(type);

export interface MenuGroup {
  label: string;
  keywords: string[];
  items: Array<{ type: string; label: string; description?: string }>;
}

export const getMenuGroups = (allowedCategories?: string[]): MenuGroup[] => {
  const groups: MenuGroup[] = [
    // Stream pipes are created automatically when a stream field is selected in Exact filter
    { label: 'Stream', keywords: ['stream'], items: [] },
    { label: 'Filter', keywords: ['filter', 'where', 'search'], items: FILTER_TEMPLATES.filter((t) => !allowedCategories || allowedCategories.includes(t.stepCategory)).map(pick) },
    { label: 'Modify', keywords: ['modify', 'transform'], items: MODIFY_TEMPLATES.filter((t) => !allowedCategories || allowedCategories.includes(t.stepCategory)).map(pick) },
    { label: 'Aggregate', keywords: ['aggregate', 'stats', 'group'], items: AGGREGATE_TEMPLATES.filter((t) => !allowedCategories || allowedCategories.includes(t.stepCategory)).map(pick) },
    { label: 'Sort', keywords: ['sort', 'order', 'by'], items: [SORT_TEMPLATE].filter((t) => !allowedCategories || allowedCategories.includes(t.stepCategory)).map(pick) },
    { label: 'Limit', keywords: ['limit'], items: LIMIT_TEMPLATES.filter((t) => !allowedCategories || allowedCategories.includes(t.stepCategory)).map(pick) },
    { label: 'Custom', keywords: ['custom', 'raw'], items: [CUSTOM_TEMPLATE].filter((t) => !allowedCategories || allowedCategories.includes(t.stepCategory)).map(pick) },
  ];
  return groups.filter((g) => g.items.length > 0);
};

const pick = (t: TemplateConfig) => ({ type: t.type, label: t.label, description: t.description });
