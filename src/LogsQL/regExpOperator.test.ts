import { getQueryExprVariableRegExp } from './regExpOperator';

describe('getQueryExprVariableRegExp', () => {
  it('should fing fieldName:~$var', () => {
    const result = getQueryExprVariableRegExp(' fieldName:~$var ');
    expect(result?.[0]).toEqual(' fieldName:~$var');
  });

  it('should find fieldName:~$var without spaces', () => {
    const result = getQueryExprVariableRegExp('fieldName:~$var');
    expect(result?.[0]).toEqual('fieldName:~$var');
  });

  it('should find fieldName:~$var at the start of string', () => {
    const result = getQueryExprVariableRegExp('fieldName:~$var and more');
    expect(result?.[0]).toContain('fieldName:~$var');
  });

  it('should find fieldName:~$var at the end of string', () => {
    const result = getQueryExprVariableRegExp('some query fieldName:~$var');
    expect(result?.[0]).toContain('fieldName:~$var');
  });

  it('should find variable with underscores', () => {
    const result = getQueryExprVariableRegExp('fieldName:~$my_var_name');
    expect(result?.[0]).toContain('$my_var_name');
  });

  it('should find variable with numbers', () => {
    const result = getQueryExprVariableRegExp('fieldName:~$var123');
    expect(result?.[0]).toContain('$var123');
  });

  it('should find complex field name with variable', () => {
    const result = getQueryExprVariableRegExp('complex_field_name:~$variable');
    expect(result?.[0]).toContain('complex_field_name:~$variable');
  });

  it('should return null for query without variables', () => {
    const result = getQueryExprVariableRegExp('fieldName:value');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = getQueryExprVariableRegExp('');
    expect(result).toBeNull();
  });

  it('should return null for string with only spaces', () => {
    const result = getQueryExprVariableRegExp('   ');
    expect(result).toBeNull();
  });

  it('should find first variable when multiple variables exist', () => {
    const result = getQueryExprVariableRegExp('field1:~$var1 field2:~$var2');
    expect(result?.[0]).toContain('$var1');
  });

  it('should find variable with special characters in field name', () => {
    const result = getQueryExprVariableRegExp('field-name:~$var');
    expect(result?.[0]).toContain('$var');
  });

  it('should not handle variable without field name prefix', () => {
    const result = getQueryExprVariableRegExp('~$var');
    expect(result).toBeNull();
  });

  it('should handle multiple spaces around variable', () => {
    const result = getQueryExprVariableRegExp('  fieldName:~$var  ');
    expect(result?.[0]).toContain('$var');
  });

  it('should find variable with mixed case field name', () => {
    const result = getQueryExprVariableRegExp('fieldName:~$MyVariable');
    expect(result?.[0]).toContain('$MyVariable');
  });
});
