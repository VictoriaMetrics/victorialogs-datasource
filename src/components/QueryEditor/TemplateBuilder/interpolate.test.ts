import { interpolateTemplateBuilder } from './interpolate';
import { PlaceholderSegment, TemplateQueryModel } from './types';

const placeholder = (id: string, value: string | null, multiValues?: string[]): PlaceholderSegment => ({
  type: 'placeholder',
  id,
  role: 'fieldValue',
  value,
  displayHint: 'value',
  optionSource: 'freeText',
  ...(multiValues ? { multi: true, multiValues } : {}),
});

const model = (segments: PlaceholderSegment[]): TemplateQueryModel => ({
  pipes: [{ id: 'p1', templateType: 'phrase', segments: [{ type: 'text', value: ':' }, ...segments], tabOrder: [] }],
});

const interpolate = (v: string) => v.replace(/\$app/g, 'smokestream');

describe('interpolateTemplateBuilder', () => {
  it('interpolates placeholder values', () => {
    const result = interpolateTemplateBuilder(model([placeholder('v1', '$app')]), interpolate);
    const seg = result.pipes[0].segments[1] as PlaceholderSegment;
    expect(seg.value).toBe('smokestream');
  });

  it('interpolates multiValues', () => {
    const result = interpolateTemplateBuilder(model([placeholder('v1', null, ['$app', 'static'])]), interpolate);
    const seg = result.pipes[0].segments[1] as PlaceholderSegment;
    expect(seg.multiValues).toEqual(['smokestream', 'static']);
  });

  it('leaves text segments and null values untouched', () => {
    const result = interpolateTemplateBuilder(model([placeholder('v1', null)]), interpolate);
    expect(result.pipes[0].segments[0]).toEqual({ type: 'text', value: ':' });
    const seg = result.pipes[0].segments[1] as PlaceholderSegment;
    expect(seg.value).toBeNull();
  });

  it('does not mutate the original model', () => {
    const original = model([placeholder('v1', '$app')]);
    interpolateTemplateBuilder(original, interpolate);
    expect((original.pipes[0].segments[1] as PlaceholderSegment).value).toBe('$app');
  });
});
