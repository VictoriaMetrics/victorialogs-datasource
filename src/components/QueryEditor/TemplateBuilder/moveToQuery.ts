import { AdHocFilter, Query, StreamFilterState } from '../../../types';
import { adHocFilterValues, formatAdHocFilterLabel } from '../../../utils/query/adHocFilters';
import { isInGroup } from '../../../utils/query/streamFilterToggle';
import { streamFilterToString } from '../StreamFilters/streamFilterUtils';

import { createPipeFromTemplate } from './hooks/useTemplateActions';
import { STREAM_TEMPLATE_TYPE } from './segmentHelpers';
import { serializeQuery } from './serialization';
import { Pipe, PlaceholderSegment, TemplateQueryModel } from './types';

type Fill = (segment: PlaceholderSegment) => string | string[] | undefined;

const fillPlaceholders = (pipe: Pipe, fill: Fill): Pipe => ({
  ...pipe,
  segments: pipe.segments.map((segment) => {
    if (segment.type !== 'placeholder') {
      return segment;
    }
    const value = fill(segment);
    if (value === undefined) {
      return segment;
    }
    return Array.isArray(value) ? { ...segment, value: null, multiValues: value } : { ...segment, value };
  }),
});

// Ad-hoc chips store values escaped for the LogsQL selector; the builder
// serialization escapes placeholder values itself, so undo it first
const unescapeChipValue = (value: string): string => value.replace(/\\(["\\])/g, '$1');

function buildCustomPipe(expr: string): Pipe | null {
  const pipe = createPipeFromTemplate('custom');
  return pipe && fillPlaceholders(pipe, (s) => (s.role === 'expression' ? expr : undefined));
}

/** Builds a builder pipe for a stream filter group: an `in` group becomes a prefilled Stream pipe, `not_in` — a custom LogsQL pipe */
export function buildPipeForStreamFilter(filter: StreamFilterState): Pipe | null {
  if (isInGroup(filter)) {
    const pipe = createPipeFromTemplate(STREAM_TEMPLATE_TYPE);
    return (
      pipe &&
      fillPlaceholders(pipe, (s) => {
        if (s.role === 'streamFieldName') {
          return filter.label;
        }
        if (s.role === 'streamFieldValue') {
          return filter.values;
        }
        return undefined;
      })
    );
  }
  return buildCustomPipe(streamFilterToString(filter));
}

export interface AdHocPipePlacement {
  pipe: Pipe;
  /** Post-filter pipes for pipe-produced fields go to the end; everything else — to the start */
  position: 'start' | 'end';
}

/**
 * Builds a builder pipe for an ad-hoc chip. Operators with a native template
 * (`=`/`=|` → Exact, `=~`/`!~` → Regexp, `<`/`>` → Range) get an editable
 * prefilled pipe; the rest fall back to a custom LogsQL pipe. Chips on fields
 * produced by the query itself become a `filter ...` pipe appended at the end
 */
export function buildPipeForAdHocFilter(filter: AdHocFilter, appendAsPostFilter: boolean): AdHocPipePlacement | null {
  if (appendAsPostFilter) {
    const pipe = buildCustomPipe(`filter ${formatAdHocFilterLabel(filter)}`);
    return pipe && { pipe, position: 'end' };
  }
  const pipe = buildNativeAdHocPipe(filter) ?? buildCustomPipe(formatAdHocFilterLabel(filter));
  return pipe && { pipe, position: 'start' };
}

function buildNativeAdHocPipe(filter: AdHocFilter): Pipe | null {
  const { key, operator } = filter;
  const value = unescapeChipValue(filter.value);

  switch (operator) {
    case '=':
    case '=|': {
      const pipe = createPipeFromTemplate('exact');
      const values = adHocFilterValues(filter).map(unescapeChipValue);
      return (
        pipe &&
        fillPlaceholders(pipe, (s) => {
          if (s.role === 'fieldName') {
            return key;
          }
          return s.role === 'fieldValue' ? values : undefined;
        })
      );
    }
    case '=~':
    case '!~': {
      const pipe = createPipeFromTemplate('regexp');
      return (
        pipe &&
        fillPlaceholders(pipe, (s) => {
          if (s.role === 'fieldName') {
            return key;
          }
          if (s.role === 'operator') {
            return operator === '=~' ? '~' : '!~';
          }
          return s.role === 'pattern' ? value : undefined;
        })
      );
    }
    case '<':
    case '>': {
      const pipe = createPipeFromTemplate('range');
      return (
        pipe &&
        fillPlaceholders(pipe, (s) => {
          if (s.role === 'fieldName') {
            return key;
          }
          if (s.role === 'operator') {
            return operator;
          }
          return s.role === 'number' ? value : undefined;
        })
      );
    }
    default:
      return null;
  }
}

/** Returns a new builder model with the pipe inserted at the requested position */
export function insertPipeIntoModel(
  model: TemplateQueryModel | undefined,
  pipe: Pipe,
  position: 'start' | 'end'
): TemplateQueryModel {
  const pipes = model?.pipes ?? [];
  return { pipes: position === 'start' ? [pipe, ...pipes] : [...pipes, pipe] };
}

/**
 * Query fields updated by inserting a pipe into the builder model. Keeps the
 * invariant that `expr` is always regenerated from the model in one place
 */
export function withPipeInserted(
  query: Query,
  pipe: Pipe,
  position: 'start' | 'end'
): Pick<Query, 'expr' | 'templateBuilder'> {
  const model = insertPipeIntoModel(query.templateBuilder, pipe, position);
  return { expr: serializeQuery(model), templateBuilder: model };
}
