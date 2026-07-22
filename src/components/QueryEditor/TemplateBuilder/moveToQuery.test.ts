import { AdHocFilter, Query, StreamFilterState } from '../../../types';

import { buildPipeForAdHocFilter, buildPipeForStreamFilter, insertPipeIntoModel, withPipeInserted } from './moveToQuery';
import { serializeQuery } from './serialization';
import { Pipe } from './types';

const serializeSingle = (pipe: Pipe | null): string => {
  expect(pipe).not.toBeNull();
  return serializeQuery({ pipes: [pipe!] });
};

describe('buildPipeForStreamFilter', () => {
  it('builds a prefilled Stream pipe for an in group', () => {
    const filter: StreamFilterState = { label: 'app', operator: 'in', values: ['a', 'b'] };
    expect(serializeSingle(buildPipeForStreamFilter(filter))).toBe('{app in("a", "b")}');
  });

  it('builds a custom LogsQL pipe for a not_in group', () => {
    const filter: StreamFilterState = { label: 'env', operator: 'not_in', values: ['prod'] };
    // a lone custom pipe gets the `*` source prefix from serializeQuery
    expect(serializeSingle(buildPipeForStreamFilter(filter))).toBe('* | _stream:{env not_in ("prod")}');
  });
});

describe('buildPipeForAdHocFilter', () => {
  const build = (filter: AdHocFilter, appendAsPostFilter = false) =>
    buildPipeForAdHocFilter(filter, appendAsPostFilter);

  it('maps = to an Exact pipe', () => {
    const placement = build({ key: 'foo', operator: '=', value: 'bar' });
    expect(placement?.position).toBe('start');
    expect(serializeSingle(placement!.pipe)).toBe('foo:in("bar")');
  });

  it('unescapes the chip value before filling the pipe', () => {
    const placement = build({ key: 'foo', operator: '=', value: 'a\\"b' });
    expect(serializeSingle(placement!.pipe)).toBe('foo:in("a\\"b")');
  });

  it('maps =| with values to an Exact pipe', () => {
    const placement = build({ key: 'foo', operator: '=|', value: '', values: ['a', 'b'] });
    expect(serializeSingle(placement!.pipe)).toBe('foo:in("a", "b")');
  });

  it('maps =~ and !~ to a Regexp pipe', () => {
    expect(serializeSingle(build({ key: 'foo', operator: '=~', value: 'ba.*' })!.pipe)).toBe('foo:~"ba.*"');
    expect(serializeSingle(build({ key: 'foo', operator: '!~', value: 'ba.*' })!.pipe)).toBe('foo:!~"ba.*"');
  });

  it('keeps the escaped regex pattern verbatim so quotes and backslashes survive', () => {
    expect(serializeSingle(build({ key: 'foo', operator: '=~', value: 'a\\"b.*' })!.pipe)).toBe('foo:~"a\\"b.*"');
    expect(serializeSingle(build({ key: 'foo', operator: '=~', value: '\\\\d+' })!.pipe)).toBe('foo:~"\\\\d+"');
  });

  it('maps < and > to a Range pipe', () => {
    expect(serializeSingle(build({ key: 'lat', operator: '<', value: '5' })!.pipe)).toBe('lat:<5');
    expect(serializeSingle(build({ key: 'lat', operator: '>', value: '5' })!.pipe)).toBe('lat:>5');
  });

  it('falls back to a custom LogsQL pipe for operators without a template', () => {
    const placement = build({ key: 'foo', operator: '!=', value: 'bar' });
    expect(serializeSingle(placement!.pipe)).toBe('* | foo:!="bar"');
  });

  it('builds a post-filter pipe at the end for invalid (pipe-produced) fields', () => {
    const placement = build({ key: 'foo', operator: '=', value: 'bar' }, true);
    expect(placement?.position).toBe('end');
    expect(serializeSingle(placement!.pipe)).toBe('* | filter foo:="bar"');
  });
});

describe('insertPipeIntoModel', () => {
  const pipe = buildPipeForStreamFilter({ label: 'app', operator: 'in', values: ['a'] })!;

  it('prepends at start and appends at end', () => {
    const model = { pipes: [buildPipeForStreamFilter({ label: 'env', operator: 'in', values: ['dev'] })!] };
    expect(insertPipeIntoModel(model, pipe, 'start').pipes[0]).toBe(pipe);
    expect(insertPipeIntoModel(model, pipe, 'end').pipes[1]).toBe(pipe);
  });

  it('creates a model when none exists', () => {
    expect(insertPipeIntoModel(undefined, pipe, 'start')).toEqual({ pipes: [pipe] });
  });
});

describe('withPipeInserted', () => {
  it('returns the new model together with the expr regenerated from it', () => {
    const query: Query = { refId: 'A', expr: 'stale', templateBuilder: { pipes: [] } };
    const pipe = buildPipeForStreamFilter({ label: 'app', operator: 'in', values: ['a'] })!;
    const result = withPipeInserted(query, pipe, 'start');
    expect(result.templateBuilder?.pipes).toEqual([pipe]);
    expect(result.expr).toBe('{app in("a")}');
  });
});
