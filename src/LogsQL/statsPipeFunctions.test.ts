import { isExprHasStatsPipeFunctions, statsPipeFunctions } from './statsPipeFunctions';

describe('isExprHasStatsPipeFunctions', () => {
  describe('should return true for each stats pipe function', () => {
    it.each(statsPipeFunctions)("detects '%s' function", (func) => {
      expect(isExprHasStatsPipeFunctions(`* | stats by () ${func}()`)).toBe(true);
    });

    it.each(statsPipeFunctions)("detects '%s' function in upper case", (func) => {
      expect(isExprHasStatsPipeFunctions(`* | stats by () ${func.toUpperCase()}()`)).toBe(true);
    });
  });
});
