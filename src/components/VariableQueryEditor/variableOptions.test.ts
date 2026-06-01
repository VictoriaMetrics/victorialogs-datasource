import { TypedVariableModel } from '@grafana/data';

import { toVariableOptions } from './variableOptions';

// minimal stub — only `name` is needed by toVariableOptions
const asVariables = (names: string[]): TypedVariableModel[] =>
  names.map((name) => ({ name })) as unknown as TypedVariableModel[];

describe('toVariableOptions', () => {
  it('returns an empty array for no variables', () => {
    expect(toVariableOptions([])).toEqual([]);
  });

  it('maps each variable to a $-prefixed option with a description', () => {
    expect(toVariableOptions(asVariables(['field_var']))).toEqual([
      { label: '$field_var', value: '$field_var', description: 'Dashboard variable' },
    ]);
  });

  it('preserves variable order', () => {
    expect(toVariableOptions(asVariables(['a', 'b', 'c'])).map((o) => o.value)).toEqual([
      '$a',
      '$b',
      '$c',
    ]);
  });

  it('keeps special characters in the variable name', () => {
    expect(toVariableOptions(asVariables(['my.var-1'])).map((o) => o.value)).toEqual(['$my.var-1']);
  });
});
