import { getQueryExprVariableRegExp, replaceRegExpOperatorToOperator } from './regExpOperator';


describe('regExpOperator', () => {
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
      expect(result?.[0]).toEqual('fieldName:~$var');
    });

    it('should find fieldName:~$var at the end of string', () => {
      const result = getQueryExprVariableRegExp('some query fieldName:~$var');
      expect(result?.[0]).toEqual(' fieldName:~$var');
    });

    it('should find variable with underscores', () => {
      const result = getQueryExprVariableRegExp('fieldName:~$my_var_name');
      expect(result?.[0]).toEqual('fieldName:~$my_var_name');
    });

    it('should find variable with numbers', () => {
      const result = getQueryExprVariableRegExp('fieldName:~$var123');
      expect(result?.[0]).toEqual('fieldName:~$var123');
    });

    it('should find complex field name with variable', () => {
      const result = getQueryExprVariableRegExp('complex_field_name:~$variable');
      expect(result?.[0]).toEqual('complex_field_name:~$variable');
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
      expect(result?.[0]).toEqual('field1:~$var1');
    });

    it('should find variable with special characters in field name', () => {
      const result = getQueryExprVariableRegExp('field-name:~$var');
      expect(result?.[0]).toEqual('field-name:~$var');
    });

    it('should not handle variable without field name prefix', () => {
      const result = getQueryExprVariableRegExp('~$var');
      expect(result).toBeNull();
    });

    it('should handle multiple spaces around variable', () => {
      const result = getQueryExprVariableRegExp('  fieldName:~$var  ');
      expect(result?.[0]).toEqual(' fieldName:~$var');
    });

    it('should find variable with mixed case field name', () => {
      const result = getQueryExprVariableRegExp('fieldName:~$MyVariable');
      expect(result?.[0]).toEqual('fieldName:~$MyVariable');
    });

    it('should find variable with dot separated field name', () => {
      const result = getQueryExprVariableRegExp('someField: Some value | field.name.with.some.dot.separated:~$MyVariable');
      expect(result?.[0]).toEqual(' field.name.with.some.dot.separated:~$MyVariable');
    });
  });

  describe('replaceRegExpOperatorToOperator', () => {
    it('should replace :~ with :', () => {
      const result = replaceRegExpOperatorToOperator('fieldName:~$var');
      expect(result).toEqual('fieldName:$var');
    });

    it('should replace :~ with a custom operator', () => {
      const result = replaceRegExpOperatorToOperator('fieldName:~$var', '!=');
      expect(result).toEqual('fieldName!=$var');
    });

    it('should ignore queries without :~', () => {
      const result = replaceRegExpOperatorToOperator('fieldName:value');
      expect(result).toEqual('fieldName:value');
    });

    it('should handle queries with spaces around :~', () => {
      const result = replaceRegExpOperatorToOperator('fieldName : ~ $var');
      expect(result).toEqual('fieldName:$var');
    });

    it('should return the same string if no match is found', () => {
      const result = replaceRegExpOperatorToOperator('');
      expect(result).toEqual('');
    });

    it('should handle multiple spaces in the query string', () => {
      const result = replaceRegExpOperatorToOperator('  fieldName  :~    $var   ');
      expect(result).toEqual('  fieldName:$var   ');
    });

    it('should replace variable with underscores', () => {
      const result = replaceRegExpOperatorToOperator('fieldName:~$my_var_name');
      expect(result).toEqual('fieldName:$my_var_name');
    });

    it('should replace variables with numbers', () => {
      const result = replaceRegExpOperatorToOperator('fieldName:~$var123');
      expect(result).toEqual('fieldName:$var123');
    });

    it('should replace complex field names with a variable', () => {
      const result = replaceRegExpOperatorToOperator('complex_field_name:~$variable');
      expect(result).toEqual('complex_field_name:$variable');
    });

    it('should handle fields with special characters', () => {
      const result = replaceRegExpOperatorToOperator('field-name:~$var');
      expect(result).toEqual('field-name:$var');
    });

    it('should replace dot-separated field names with variables', () => {
      const result = replaceRegExpOperatorToOperator('field.name.with.dots:~$variable');
      expect(result).toEqual('field.name.with.dots:$variable');
    });
  });
});
