import { isExprHasStatsPipeFunc, isExprHasStatsPipeFunctions, statsPipeFunctions } from './statsPipeFunctions';

describe('isExprHasStatsPipeFunctions', () => {
  describe('should return true for each stats pipe function', () => {
    it.each(statsPipeFunctions)("detects '%s' function", (func) => {
      expect(isExprHasStatsPipeFunctions(`* | stats by () ${func}()`)).toBe(true);
    });

    it.each(statsPipeFunctions)("detects '%s' function in upper case", (func) => {
      expect(isExprHasStatsPipeFunctions(`* | stats by () ${func.toUpperCase()}()`)).toBe(true);
    });
  });

  it('detects a function call with a space before the parentheses', () => {
    expect(isExprHasStatsPipeFunctions('* | stats count ()')).toBe(true);
  });

  it.each(['* | filter any', '* | fields count, values', '* | rate', 'error | any'])(
    'ignores a function name used as a plain word in `%s`',
    (expr) => {
      expect(isExprHasStatsPipeFunctions(expr)).toBe(false);
    }
  );

  it('ignores a function call before the first pipe', () => {
    expect(isExprHasStatsPipeFunctions('_msg:count(*)')).toBe(false);
  });
});

describe('isExprHasStatsPipeFunc', () => {
  it('detects the given function call', () => {
    expect(isExprHasStatsPipeFunc('* | stats histogram(duration)', 'histogram')).toBe(true);
  });

  it('ignores the function name used as a field name', () => {
    expect(isExprHasStatsPipeFunc('* | fields histogram', 'histogram')).toBe(false);
  });

  it('ignores other function calls', () => {
    expect(isExprHasStatsPipeFunc('* | stats count()', 'histogram')).toBe(false);
  });
});
