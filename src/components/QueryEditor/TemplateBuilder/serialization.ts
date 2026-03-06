import { getTemplate } from './templates/registry';
import { Pipe, PlaceholderSegment, Segment, TemplateQueryModel } from './types';

const needsQuotes = (role: string): boolean =>
  role === 'fieldValue' || role === 'streamFieldValue';

const isFieldNameRole = (role: string): boolean =>
  role === 'fieldName' || role === 'streamFieldName';

const needsFieldNameQuotes = (value: string): boolean =>
  !/^[a-zA-Z0-9_.]+$/.test(value);

const escapeValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const formatValue = (value: string, segment: PlaceholderSegment): string => {
  if (value === '*') {
    return '*';
  }
  if (needsQuotes(segment.role)) {
    return `"${escapeValue(value)}"`;
  }
  if (isFieldNameRole(segment.role) && needsFieldNameQuotes(value)) {
    return `"${escapeValue(value)}"`;
  }
  return value;
};

const serializeSegment = (segment: Segment): string => {
  if (segment.type === 'text') {
    return segment.value;
  }

  if (segment.multi && segment.multiValues?.length) {
    return segment.multiValues.map((v) => formatValue(v, segment)).join(', ');
  }

  if (segment.value) {
    return formatValue(segment.value, segment);
  }

  return '';
};

export const serializePipe = (pipe: Pipe): string => {
  return pipe.segments.map(serializeSegment).join('');
};

const isStreamPipe = (pipe: Pipe): boolean => pipe.templateType === 'stream';

const FILTER_CATEGORIES = new Set(['stream', 'filter']);

const hasFilterPipe = (pipes: Pipe[]): boolean =>
  pipes.some((p) => {
    const config = getTemplate(p.templateType);
    return config != null && FILTER_CATEGORIES.has(config.stepCategory);
  });

export const serializeQuery = (model: TemplateQueryModel): string => {
  const parts: string[] = [];

  for (const pipe of model.pipes) {
    const serialized = serializePipe(pipe);
    if (!serialized) {
      continue;
    }
    if (isStreamPipe(pipe)) {
      parts.push(`{${serialized}}`);
    } else {
      parts.push(serialized);
    }
  }

  if (parts.length === 0) {
    return '*';
  }

  if (!hasFilterPipe(model.pipes)) {
    parts.unshift('*');
  }

  return parts.join(' | ');
};

/** Build queryContext for a given pipe index — serializes all pipes before that index as-is. */
export const buildPipeQueryContext = (model: TemplateQueryModel, pipeIndex: number): string => {
  const preceding: TemplateQueryModel = { pipes: model.pipes.slice(0, pipeIndex) };
  return serializeQuery(preceding);
};
