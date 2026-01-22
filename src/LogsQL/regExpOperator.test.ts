import {
  correctRegExpValueAll,
  doubleQuoteRegExp,
  getQueryExprVariableRegExp,
  isRegExpOperatorInLastFilter,
  replaceRegExpOperatorToOperator
} from './regExpOperator';


describe('regExpOperator', () => {
  describe('getQueryExprVariableRegExp', () => {
    it('should not find regexp var', () => {
      const result = getQueryExprVariableRegExp('"fieldName":~"var.*"');
      expect(result?.[0]).toBeUndefined();
    });

    it('should not find regexp var with spaces', () => {
      const result = getQueryExprVariableRegExp(' "fieldName":~"var.*" ');
      expect(result?.[0]).toBeUndefined();
    });

    it('should find fieldName:~$var with doublequotes', () => {
      const result = getQueryExprVariableRegExp('fieldName:~"$var"');
      expect(result?.[0]).toEqual('fieldName:~"$var"');
    });

    it('should find fieldName:~$var', () => {
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

    it('should replace all regexp vars', () => {
      const result = replaceRegExpOperatorToOperator('field.name.with.dots1:~$variable field.name.with.dots2:~$variable | field.name.with.dots3:~$variable field.name.with.dots4:~variable field.name.with.dots3:$variable');
      expect(result).toEqual('field.name.with.dots1:$variable field.name.with.dots2:$variable | field.name.with.dots3:$variable field.name.with.dots4:~variable field.name.with.dots3:$variable');
    });

    it('should replace all regexp vars with new lines', () => {
      const result = replaceRegExpOperatorToOperator(`kubernetes.pod_namespace:~"$namespace" kubernetes.pod_name:~"$pod" 
                                                                          | stats by(kubernetes.pod_name) count() 
                                                                          | count()`
      );
      expect(result).toEqual(`kubernetes.pod_namespace:"$namespace" kubernetes.pod_name:"$pod" 
                                                                          | stats by(kubernetes.pod_name) count() 
                                                                          | count()`
      );
    });
  });

  describe('lookRegExpOperatorBehind', () => {
    it('should return false for an empty string', () => {
      const result = isRegExpOperatorInLastFilter('');
      expect(result).toBeFalsy()
    });

    it('should return false for a string without regexp operator', () => {
      const result = isRegExpOperatorInLastFilter('fieldName:value');
      expect(result).toBeFalsy();
    });

    it('should return true for a string with :~ inside double quotes', () => {
      const result = isRegExpOperatorInLastFilter('fieldName:~"');
      expect(result).toBeTruthy();
    });

    it('should return true for a string with :~ with double quotes', () => {
      const result = isRegExpOperatorInLastFilter('fieldName:~"(?i)');
      expect(result).toBeTruthy();
    });

    it('should return false for multiple pipes and valid :~ operator but in previous filter', () => {
      const result = isRegExpOperatorInLastFilter('someField:value | anotherField:~"$var" | moreField:"');
      expect(result).toBeFalsy();
    });

    it('should return false for a string with a pipe before any :~ operator', () => {
      const result = isRegExpOperatorInLastFilter('someField:~value | anotherField:value');
      expect(result).toBeFalsy();
    });

    it('should return true for :~ operator with multiple spaces and double quotes', () => {
      const result = isRegExpOperatorInLastFilter('fieldName :    ~    ".*');
      expect(result).toBeTruthy();
    });

    it('should return true for a valid :~ operator at the end of the string', () => {
      const result = isRegExpOperatorInLastFilter('someField:value | fieldName:~"var regexp');
      expect(result).toBeTruthy();
    });

    it('should return false for :~ operator when not preceded by : or =', () => {
      const result = isRegExpOperatorInLastFilter('fieldName~"$var"');
      expect(result).toBeFalsy();
    });

    it('should return false for a string with a missing ~ operator after :', () => {
      const result = isRegExpOperatorInLastFilter('fieldName:"$var"');
      expect(result).toBeFalsy();
    });

    it('should return true when operator is preceded by = (e.g., =~)', () => {
      const result = isRegExpOperatorInLastFilter('someField =~"val');
      expect(result).toBeTruthy();
    });

    it('should return false for a string where :~ is outside double quotes', () => {
      const result = isRegExpOperatorInLastFilter('fieldName:~$var anotherField:value');
      expect(result).toBeFalsy();
    });

    it('should true for stream filter', () => {
      const result = isRegExpOperatorInLastFilter('{"stream"="stdout" name=~".*n');
      expect(result).toBeTruthy();
    });

    it('should return false if regexp filter on another line', () => {
      const result = isRegExpOperatorInLastFilter(`
        filterName1!:~"$filter"
         filtername2='somevalue'
      `);
      expect(result).toBeFalsy();
    });

    it('should return true if regexp filter contain |', () => {
      const result = isRegExpOperatorInLastFilter(`filterName1:~"(a|b)$filter`);
      expect(result).toBeTruthy();
    });

    it('should return true if regexp filter contain escaping double quotes', () => {
      const result = isRegExpOperatorInLastFilter(`filterName1:~ "\\"([^\\"]*)\\"$filter`);
      expect(result).toBeTruthy();
    });
  });

  describe('doubleQuoteRegExpOperator', () => { 
    it('should wrap variable with double quotes when :~$ is present', () => {
      const result = doubleQuoteRegExp('fieldName:~$var', ['var']);
      expect(result).toEqual('fieldName:~"$var"');
    });

    it('should wrap multiple variables', () => {
      const result = doubleQuoteRegExp('f1:~$var1 f2:~$var2', ['var1', 'var2']);
      expect(result).toEqual('f1:~"$var1" f2:~"$var2"');
    });

    it('should not wrap if operator is not :~$', () => {
      const result = doubleQuoteRegExp('fieldName:$var', ['var']);
      expect(result).toEqual('fieldName:$var');
    });

    it('should handle variables with special regex characters', () => {
      const result = doubleQuoteRegExp('field:~$var.name', ['var.name']);
      expect(result).toEqual('field:~"$var.name"');
    });

    it('should respect word boundaries and not match partial variable names', () => {
      const result = doubleQuoteRegExp('f1:~$var f2:~$var2', ['var']);
      expect(result).toEqual('f1:~"$var" f2:~$var2');
    });

    it('should return original string if variables list is empty', () => {
      const query = 'fieldName:~$var';
      const result = doubleQuoteRegExp(query, []);
      expect(result).toEqual(query);
    });

    it('should handle query with no matches', () => {
      const query = 'some random text';
      const result = doubleQuoteRegExp(query, ['var']);
      expect(result).toEqual(query);
    });

    it('should handle multiple occurrences of the same variable', () => {
      const result = doubleQuoteRegExp('f1:~$var f2:~$var', ['var']);
      expect(result).toEqual('f1:~"$var" f2:~"$var"');
    });

    it('should handle query with the space before value', () => {
      const result = doubleQuoteRegExp('f1:~ $var', ['var']);
      expect(result).toEqual('f1:~"$var"');
    });
  });

  describe('correctRegExpValueAll', () => {
    it('should replace :~"*": the basic case', () => {
      expect(correctRegExpValueAll('field:~"*"' )).toEqual('field:~".*"');
    });

    it('should replace :~   "*": with spaces after operator', () => {
      expect(correctRegExpValueAll('field:~   "*"' )).toEqual('field:~".*"');
    });

    it('should replace :~"*": when it is a part of a longer query', () => {
      expect(correctRegExpValueAll('a:1 b:~"*"' )).toEqual('a:1 b:~".*"');
    });

    it('should replace all occurrences (global replacement)', () => {
      const input = 'f1:~"*" f2:~   "*" | f3:~"*" f4:"*"';
      const output = 'f1:~".*" f2:~".*" | f3:~".*" f4:"*"';
      expect(correctRegExpValueAll(input)).toEqual(output);
    });

    it('should handle newlines/tabs after :~ (whitespace is allowed)', () => {
      const input = `f1:~\n"*"\nf2:~\t"*"`;
      const output = `f1:~".*"\nf2:~".*"`;
      expect(correctRegExpValueAll(input)).toEqual(output);
    });

    it('should not change query when there is no :~"*"', () => {
      const input = 'field:"*" field:~".*" field:~"$var"';
      expect(correctRegExpValueAll(input)).toEqual(input);
    });

    it('should not replace when there are spaces inside the quotes (pattern is exactly "*")', () => {
      const input = 'field:~" * " field:~"*"';
      const output = 'field:~" * " field:~".*"';
      expect(correctRegExpValueAll(input)).toEqual(output);
    });

    it('should not replace for other operators (e.g. =~ or !~) — only :~ is handled', () => {
      const input = 'field:="*" field:!="*" field:~"*"';
      const output = 'field:="*" field:!="*" field:~".*"';
      expect(correctRegExpValueAll(input)).toEqual(output);
    });

    it('should return empty string as is', () => {
      expect(correctRegExpValueAll('')).toEqual('');
    });

    it('should be idempotent (running twice does not change result)', () => {
      const input = 'f1:~"*" f2:~   "*"';
      const once = correctRegExpValueAll(input);
      const twice = correctRegExpValueAll(once);
      expect(once).toEqual('f1:~".*" f2:~".*"');
      expect(twice).toEqual(once);
    });

    it('should replace :!~"*": the basic case', () => {
      expect(correctRegExpValueAll('field:!~"*"' )).toEqual('field:!~".*"');
    });

    it('should replace :!~   "*": with spaces/newlines after operator', () => {
      const input = `field:!~\n"*"\nother:1`;
      const output = `field:!~".*"\nother:1`;
      expect(correctRegExpValueAll(input)).toEqual(output);
    });

    it('should replace both :~"*"" and :!~"*"" in the same query', () => {
      const input = 'f1:~"*" f2:!~   "*" | f3:~"*" f4:"*"';
      const output = 'f1:~".*" f2:!~".*" | f3:~".*" f4:"*"';
      expect(correctRegExpValueAll(input)).toEqual(output);
    });
  });
});
