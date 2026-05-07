import { AGGREGATE_MODIFY_TEMPLATES } from './aggregateModifyTemplates';
import { AGGREGATE_TEMPLATES } from './aggregateTemplates';
import { CUSTOM_TEMPLATE } from './customTemplate';
import { FILTER_TEMPLATES, STREAM_TEMPLATE } from './filterTemplates';
import { LIMIT_TEMPLATES } from './limitTemplates';
import { MODIFY_TEMPLATES } from './modifyTemplates';
import { SORT_TEMPLATE } from './sortTemplate';

describe('filter templates', () => {
  it('exact creates correct segments', () => {
    const config = FILTER_TEMPLATES.find((t) => t.type === 'exact')!;
    const segments = config.createSegments();
    expect(segments).toHaveLength(4);
    expect(segments[0]).toMatchObject({ type: 'placeholder', role: 'fieldName' });
    expect(segments[1]).toMatchObject({ type: 'text', value: ':in(' });
    expect(segments[2]).toMatchObject({ type: 'placeholder', role: 'fieldValue', multi: true });
    expect(segments[3]).toMatchObject({ type: 'text', value: ')' });
  });

  it('phrase creates correct segments', () => {
    const config = FILTER_TEMPLATES.find((t) => t.type === 'phrase')!;
    const segments = config.createSegments();
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ type: 'placeholder', role: 'fieldName' });
    expect(segments[1]).toMatchObject({ type: 'text', value: ':' });
    expect(segments[2]).toMatchObject({ type: 'placeholder', role: 'fieldValue' });
  });

  it('range creates correct segments with operator', () => {
    const config = FILTER_TEMPLATES.find((t) => t.type === 'range')!;
    const segments = config.createSegments();
    expect(segments[0]).toMatchObject({ type: 'placeholder', role: 'fieldName' });
    expect(segments[1]).toMatchObject({ type: 'text', value: ':' });
    expect(segments[2]).toMatchObject({ type: 'placeholder', role: 'operator', optionSource: 'static' });
    expect(segments[3]).toMatchObject({ type: 'placeholder', role: 'number' });
  });

  it('stream creates field name and multi values placeholders', () => {
    const config = STREAM_TEMPLATE;
    const segments = config.createSegments();
    expect(segments).toHaveLength(4);
    expect(segments[0]).toMatchObject({ type: 'placeholder', role: 'streamFieldName', optionSource: 'streamFieldNames' });
    expect(segments[1]).toMatchObject({ type: 'text', value: ' in(' });
    expect(segments[2]).toMatchObject({ type: 'placeholder', role: 'streamFieldValue', optionSource: 'streamFieldValues', multi: true });
    expect(segments[3]).toMatchObject({ type: 'text', value: ')' });
  });

  it('tabOrder returns placeholder IDs in order', () => {
    const config = FILTER_TEMPLATES.find((t) => t.type === 'exact')!;
    const segments = config.createSegments();
    const order = config.tabOrder(segments);
    expect(order).toHaveLength(2);
    expect(order[0]).toMatch(/fieldName/);
    expect(order[1]).toMatch(/values/);
  });
});

describe('modify templates', () => {
  it('rename creates src/dst placeholders', () => {
    const config = MODIFY_TEMPLATES.find((t) => t.type === 'rename')!;
    const segments = config.createSegments();
    expect(segments[0]).toMatchObject({ type: 'text', value: 'rename ' });
    expect(segments[1]).toMatchObject({ type: 'placeholder', role: 'fieldName' });
    expect(segments[2]).toMatchObject({ type: 'text', value: ' as ' });
    expect(segments[3]).toMatchObject({ type: 'placeholder', role: 'expression' });
  });

  it('delete creates multi fieldName placeholder', () => {
    const config = MODIFY_TEMPLATES.find((t) => t.type === 'delete')!;
    const segments = config.createSegments();
    expect(segments[0]).toMatchObject({ type: 'text', value: 'delete ' });
    expect(segments[1]).toMatchObject({ type: 'placeholder', role: 'fieldName', multi: true });
  });

  it('replace creates old/new/field placeholders', () => {
    const config = MODIFY_TEMPLATES.find((t) => t.type === 'replace')!;
    const segments = config.createSegments();
    const placeholders = segments.filter((s) => s.type === 'placeholder');
    expect(placeholders).toHaveLength(3);
  });

  it('drop_empty_fields creates no placeholders', () => {
    const config = MODIFY_TEMPLATES.find((t) => t.type === 'drop_empty_fields')!;
    const segments = config.createSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: 'text', value: 'drop_empty_fields' });
  });

  it('has all expected modify types', () => {
    const types = MODIFY_TEMPLATES.map((t) => t.type);
    expect(types).toContain('rename');
    expect(types).toContain('copy');
    expect(types).toContain('delete');
    expect(types).toContain('keep');
    expect(types).toContain('replace');
    expect(types).toContain('replace_regexp');
    expect(types).toContain('extract');
    expect(types).toContain('extract_regexp');
    expect(types).toContain('format');
    expect(types).toContain('pack_json');
    expect(types).toContain('pack_logfmt');
    expect(types).toContain('unpack_json');
    expect(types).toContain('unpack_logfmt');
    expect(types).toContain('drop_empty_fields');
  });
});

describe('aggregate templates', () => {
  it('stats_count has stats prefix and function segments', () => {
    const config = AGGREGATE_TEMPLATES.find((t) => t.type === 'stats_count')!;
    const segments = config.createSegments();
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ type: 'text', value: 'stats ' });
    expect(segments[1]).toMatchObject({ type: 'text', value: 'count()' });
  });

  it('stats_sum has field placeholder', () => {
    const config = AGGREGATE_TEMPLATES.find((t) => t.type === 'stats_sum')!;
    const segments = config.createSegments();
    expect(segments[0]).toMatchObject({ type: 'text', value: 'stats ' });
    const placeholders = segments.filter((s) => s.type === 'placeholder');
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0]).toMatchObject({ role: 'fieldName', multi: true });
  });

  it('stats_quantile has phi and fields', () => {
    const config = AGGREGATE_TEMPLATES.find((t) => t.type === 'stats_quantile')!;
    const segments = config.createSegments();
    const placeholders = segments.filter((s) => s.type === 'placeholder');
    expect(placeholders).toHaveLength(2);
    expect(placeholders[0]).toMatchObject({ role: 'number' });
    expect(placeholders[1]).toMatchObject({ role: 'fieldName', multi: true });
  });

  it('all aggregate templates have optional extensions', () => {
    for (const t of AGGREGATE_TEMPLATES) {
      expect(t.optionalExtensions).toBeDefined();
      expect(t.optionalExtensions!.some((e) => e.key === 'by')).toBe(true);
    }
  });
});

describe('sort template', () => {
  it('creates field and direction placeholders', () => {
    const segments = SORT_TEMPLATE.createSegments();
    const placeholders = segments.filter((s) => s.type === 'placeholder');
    expect(placeholders).toHaveLength(2);
    expect(placeholders[0]).toMatchObject({ role: 'fieldName' });
    expect(placeholders[1]).toMatchObject({ role: 'direction', optionSource: 'static' });
  });

  it('has optional extensions', () => {
    expect(SORT_TEMPLATE.optionalExtensions).toBeDefined();
    const keys = SORT_TEMPLATE.optionalExtensions!.map((e) => e.key);
    expect(keys).toContain('offset');
    expect(keys).toContain('limit');
    expect(keys).toContain('partition_by');
    expect(keys).toContain('rank_as');
  });
});

describe('limit templates', () => {
  it('limit has count placeholder', () => {
    const config = LIMIT_TEMPLATES.find((t) => t.type === 'limit')!;
    const segments = config.createSegments();
    expect(segments[1]).toMatchObject({ type: 'placeholder', role: 'number' });
  });

  it('first has count and fields', () => {
    const config = LIMIT_TEMPLATES.find((t) => t.type === 'first')!;
    const segments = config.createSegments();
    const placeholders = segments.filter((s) => s.type === 'placeholder');
    expect(placeholders).toHaveLength(2);
  });
});

describe('custom template', () => {
  it('creates freeText expression placeholder', () => {
    const segments = CUSTOM_TEMPLATE.createSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: 'placeholder', role: 'expression', optionSource: 'freeText' });
  });
});

describe('aggregate modify templates', () => {
  it('math has expression and result placeholders', () => {
    const config = AGGREGATE_MODIFY_TEMPLATES.find((t) => t.type === 'agg_math')!;
    const segments = config.createSegments();
    const placeholders = segments.filter((s) => s.type === 'placeholder');
    expect(placeholders).toHaveLength(2);
  });
});
