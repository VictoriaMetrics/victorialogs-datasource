import { Segment, TemplateQueryModel } from './types';

type Interpolate = (value: string) => string;

/**
 * Returns a copy of the builder model with template variables resolved in the
 * placeholder values. Used on the dashboard → Explore transition, where the
 * dashboard variables no longer exist and raw `$var` placeholders would
 * otherwise leak into the regenerated query expression
 */
export function interpolateTemplateBuilder(model: TemplateQueryModel, interpolate: Interpolate): TemplateQueryModel {
  return {
    pipes: model.pipes.map((pipe) => ({
      ...pipe,
      segments: pipe.segments.map((segment) => interpolateSegment(segment, interpolate)),
    })),
  };
}

function interpolateSegment(segment: Segment, interpolate: Interpolate): Segment {
  if (segment.type !== 'placeholder') {
    return segment;
  }
  return {
    ...segment,
    value: segment.value != null ? interpolate(segment.value) : segment.value,
    ...(segment.multiValues ? { multiValues: segment.multiValues.map(interpolate) } : {}),
  };
}
