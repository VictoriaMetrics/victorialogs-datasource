import { placeholder, text } from './segmentHelpers';
import { serializePipe, serializeQuery, buildPipeQueryContext } from './serialization';
import { Pipe, PlaceholderSegment } from './types';

const makePipe = (templateType: string, segments: any[]): Pipe => ({
  id: 'p1',
  templateType,
  segments,
  tabOrder: [],
});

describe('serializePipe', () => {
  it('serializes text segments', () => {
    const pipe = makePipe('test', [text('rename '), text('foo'), text(' as '), text('bar')]);
    expect(serializePipe(pipe)).toBe('rename foo as bar');
  });

  it('serializes filled placeholders', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'level' };
    const val = { ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const }), value: 'error' };
    const pipe = makePipe('phrase', [field, text(':'), val]);
    expect(serializePipe(pipe)).toBe('level:"error"');
  });

  it('serializes multi-value placeholders', () => {
    const vals: PlaceholderSegment = {
      ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const, multi: true }),
      multiValues: ['nginx', 'apache'],
    };
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'app' };
    const pipe = makePipe('exact', [field, text(':in('), vals, text(')')]);
    expect(serializePipe(pipe)).toBe('app:in("nginx", "apache")');
  });

  it('skips unfilled placeholders', () => {
    const field = placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const });
    const pipe = makePipe('phrase', [field, text(':'), text('value')]);
    expect(serializePipe(pipe)).toBe(':value');
  });
});

describe('serializeQuery', () => {
  it('joins pipes with |', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'msg' };
    const p1 = makePipe('phrase', [field, text(':'), text('error')]);
    const p2 = makePipe('delete', [text('delete '), field]);
    expect(serializeQuery({ pipes: [p1, p2] })).toBe('msg:error | delete msg');
  });

  it('returns * for empty pipes', () => {
    expect(serializeQuery({ pipes: [] })).toBe('*');
  });

  it('wraps a single stream pipe in braces', () => {
    const field = { ...placeholder('f', { role: 'streamFieldName' as const, displayHint: '', optionSource: 'streamFieldNames' as const }), value: 'app' };
    const vals: PlaceholderSegment = {
      ...placeholder('v', { role: 'streamFieldValue' as const, displayHint: '', optionSource: 'streamFieldValues' as const, multi: true }),
      multiValues: ['nginx'],
    };
    const p = makePipe('stream', [field, text(' in('), vals, text(')')]);
    expect(serializeQuery({ pipes: [p] })).toBe('{app in("nginx")}');
  });

  it('separates consecutive stream pipes into individual brace blocks', () => {
    const f1 = { ...placeholder('f1', { role: 'streamFieldName' as const, displayHint: '', optionSource: 'streamFieldNames' as const }), value: 'app' };
    const v1: PlaceholderSegment = {
      ...placeholder('v1', { role: 'streamFieldValue' as const, displayHint: '', optionSource: 'streamFieldValues' as const, multi: true }),
      multiValues: ['nginx'],
    };
    const p1 = makePipe('stream', [f1, text(' in('), v1, text(')')]);

    const f2 = { ...placeholder('f2', { role: 'streamFieldName' as const, displayHint: '', optionSource: 'streamFieldNames' as const }), value: 'host' };
    const v2: PlaceholderSegment = {
      ...placeholder('v2', { role: 'streamFieldValue' as const, displayHint: '', optionSource: 'streamFieldValues' as const, multi: true }),
      multiValues: ['h1', 'h2'],
    };
    const p2 = makePipe('stream', [f2, text(' in('), v2, text(')')]);

    expect(serializeQuery({ pipes: [p1, p2] })).toBe('{app in("nginx")} | {host in("h1", "h2")}');
  });

  it('separates stream block from regular pipes with |', () => {
    const sf = { ...placeholder('sf', { role: 'streamFieldName' as const, displayHint: '', optionSource: 'streamFieldNames' as const }), value: 'app' };
    const sv: PlaceholderSegment = {
      ...placeholder('sv', { role: 'streamFieldValue' as const, displayHint: '', optionSource: 'streamFieldValues' as const, multi: true }),
      multiValues: ['nginx'],
    };
    const stream = makePipe('stream', [sf, text(' in('), sv, text(')')]);
    const regular = makePipe('phrase', [text('*')]);
    expect(serializeQuery({ pipes: [stream, regular] })).toBe('{app in("nginx")} | *');
  });

  it('serializes exact pipe with * value keeping field name', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'level' };
    const vals: PlaceholderSegment = {
      ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const, multi: true }),
      multiValues: ['*'],
    };
    const pipe = makePipe('exact', [field, text(':in('), vals, text(')')]);
    expect(serializePipe(pipe)).toBe('level:in(*)');
  });

  it('serializes stream pipe with * value keeping field name', () => {
    const sf = { ...placeholder('sf', { role: 'streamFieldName' as const, displayHint: '', optionSource: 'streamFieldNames' as const }), value: 'app' };
    const sv: PlaceholderSegment = {
      ...placeholder('sv', { role: 'streamFieldValue' as const, displayHint: '', optionSource: 'streamFieldValues' as const, multi: true }),
      multiValues: ['*'],
    };
    const stream = makePipe('stream', [sf, text(' in('), sv, text(')')]);
    expect(serializeQuery({ pipes: [stream] })).toBe('{app in(*)}');
  });

  it('does not quote * in multi-values list', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'level' };
    const vals: PlaceholderSegment = {
      ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const, multi: true }),
      multiValues: ['*', 'error'],
    };
    const pipe = makePipe('exact', [field, text(':in('), vals, text(')')]);
    expect(serializePipe(pipe)).toBe('level:in(*, "error")');
  });

  it('serializes stats with by extension before function', () => {
    const byFields: PlaceholderSegment = {
      ...placeholder('by', { role: 'fieldName' as const, displayHint: 'fields', optionSource: 'fieldNames' as const, multi: true }),
      multiValues: ['level', 'app'],
    };
    const pipe = makePipe('stats_count', [
      text('stats '),
      text('by ('), byFields, text(') '),
      text('count()'),
    ]);
    expect(serializePipe(pipe)).toBe('stats by (level, app) count()');
  });

  it('serializes replace with correct quoting from text segments', () => {
    const old = { ...placeholder('old', { role: 'text' as const, displayHint: '', optionSource: 'freeText' as const }), value: 'hello' };
    const nw = { ...placeholder('new', { role: 'text' as const, displayHint: '', optionSource: 'freeText' as const }), value: 'world' };
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: '_msg' };
    const pipe = makePipe('replace', [text('replace ("'), old, text('", "'), nw, text('") at '), field]);
    expect(serializePipe(pipe)).toBe('replace ("hello", "world") at _msg');
  });

  it('serializes extract with correct quoting from text segments', () => {
    const pat = { ...placeholder('p', { role: 'pattern' as const, displayHint: '', optionSource: 'freeText' as const }), value: '<ip> - <msg>' };
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: '_msg' };
    const pipe = makePipe('extract', [text('extract "'), pat, text('" from '), field]);
    expect(serializePipe(pipe)).toBe('extract "<ip> - <msg>" from _msg');
  });

  it('serializes rename without quoting identifier', () => {
    const src = { ...placeholder('s', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'old_name' };
    const dst = { ...placeholder('d', { role: 'expression' as const, displayHint: '', optionSource: 'freeText' as const }), value: 'new_name' };
    const pipe = makePipe('rename', [text('rename '), src, text(' as '), dst]);
    expect(serializePipe(pipe)).toBe('rename old_name as new_name');
  });
});

describe('serializeQuery — auto * prefix', () => {
  it('prepends * when pipes have no filter or stream pipe', () => {
    const pipe = makePipe('stats_count', [text('stats count()')]);
    expect(serializeQuery({ pipes: [pipe] })).toBe('* | stats count()');
  });

  it('does not prepend * when a filter pipe is present', () => {
    const filter = makePipe('phrase', [text('level:error')]);
    const stat = makePipe('stats_count', [text('stats count()')]);
    expect(serializeQuery({ pipes: [filter, stat] })).toBe('level:error | stats count()');
  });

  it('does not prepend * when a stream pipe is present', () => {
    const sf = { ...placeholder('sf', { role: 'streamFieldName' as const, displayHint: '', optionSource: 'streamFieldNames' as const }), value: 'app' };
    const sv: PlaceholderSegment = {
      ...placeholder('sv', { role: 'streamFieldValue' as const, displayHint: '', optionSource: 'streamFieldValues' as const, multi: true }),
      multiValues: ['nginx'],
    };
    const stream = makePipe('stream', [sf, text(' in('), sv, text(')')]);
    const stat = makePipe('stats_count', [text('stats count()')]);
    expect(serializeQuery({ pipes: [stream, stat] })).toBe('{app in("nginx")} | stats count()');
  });

  it('returns * for empty pipes array', () => {
    expect(serializeQuery({ pipes: [] })).toBe('*');
  });
});

describe('field name quoting', () => {
  it('does not quote simple field names', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'level' };
    const val = { ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const }), value: 'error' };
    const pipe = makePipe('phrase', [field, text(':'), val]);
    expect(serializePipe(pipe)).toBe('level:"error"');
  });

  it('does not quote field names with dots and underscores', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'request.path_info' };
    const val = { ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const }), value: '/' };
    const pipe = makePipe('phrase', [field, text(':'), val]);
    expect(serializePipe(pipe)).toBe('request.path_info:"/"');
  });

  it('quotes field names with dashes', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'my-field' };
    const val = { ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const }), value: 'value' };
    const pipe = makePipe('phrase', [field, text(':'), val]);
    expect(serializePipe(pipe)).toBe('"my-field":"value"');
  });

  it('quotes field names with spaces', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'field name' };
    const val = { ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const }), value: 'val' };
    const pipe = makePipe('phrase', [field, text(':'), val]);
    expect(serializePipe(pipe)).toBe('"field name":"val"');
  });

  it('quotes stream field names with special chars', () => {
    const field = { ...placeholder('f', { role: 'streamFieldName' as const, displayHint: '', optionSource: 'streamFieldNames' as const }), value: 'my-app' };
    const vals: PlaceholderSegment = {
      ...placeholder('v', { role: 'streamFieldValue' as const, displayHint: '', optionSource: 'streamFieldValues' as const, multi: true }),
      multiValues: ['nginx'],
    };
    const pipe = makePipe('stream', [field, text(' in('), vals, text(')')]);
    expect(serializePipe(pipe)).toBe('"my-app" in("nginx")');
  });

  it('does not quote * as field name', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: '*' };
    const pipe = makePipe('phrase', [field, text(':'), text('error')]);
    expect(serializePipe(pipe)).toBe('*:error');
  });

  it('escapes quotes inside field names', () => {
    const field = { ...placeholder('f', { role: 'fieldName' as const, displayHint: '', optionSource: 'fieldNames' as const }), value: 'field"name' };
    const val = { ...placeholder('v', { role: 'fieldValue' as const, displayHint: '', optionSource: 'fieldValues' as const }), value: 'val' };
    const pipe = makePipe('phrase', [field, text(':'), val]);
    expect(serializePipe(pipe)).toBe('"field\\"name":"val"');
  });
});

describe('buildPipeQueryContext', () => {
  it('includes all preceding pipes regardless of fill state', () => {
    const emptyPipe = makePipe('stats_count', [text('stats count()')]);
    const targetPipe = makePipe('phrase', [text('level:error')]);
    const model = { pipes: [emptyPipe, targetPipe] };
    expect(buildPipeQueryContext(model, 1)).toBe('* | stats count()');
  });

  it('returns * when no preceding pipes', () => {
    const pipe = makePipe('phrase', [text('level:error')]);
    expect(buildPipeQueryContext({ pipes: [pipe] }, 0)).toBe('*');
  });

  it('includes unfilled placeholders as empty strings', () => {
    const field = placeholder('f', { role: 'fieldName' as const, displayHint: 'field_name', optionSource: 'fieldNames' as const });
    const unfilled = makePipe('phrase', [field, text(':'), text('error')]);
    const target = makePipe('stats_count', [text('stats count()')]);
    expect(buildPipeQueryContext({ pipes: [unfilled, target] }, 1)).toBe(':error');
  });
});
