import { buildQueryExprWithLevelFilters } from "./utils";

describe("buildQueryExprWithLevelFilters", () => {
  it("should return levelQueryExpr if queryExpr is empty", () => {
    const result = buildQueryExprWithLevelFilters({
      queryExpr: "",
      levelQueryExpr: "level: info",
      isUnknownFilter: false,
      isShiftPressed: false,
    });
    expect(result).toBe("level: info");
  });

  it("should handle queries without pipes and add the level query", () => {
    const result = buildQueryExprWithLevelFilters({
      queryExpr: "filterName1: filterValue1",
      levelQueryExpr: "level: error",
      isUnknownFilter: false,
      isShiftPressed: false,
    });
    expect(result).toBe("level: error | filterName1: filterValue1");
  });

  it("should prepend the level query if a level filter already exists and shift is pressed", () => {
    const result = buildQueryExprWithLevelFilters({
      queryExpr: "filterName1: filterValue1 level: warning",
      levelQueryExpr: "level: error",
      isUnknownFilter: false,
      isShiftPressed: true,
    });
    expect(result).toBe("level: error OR filterName1: filterValue1 level: warning");
  });

  it("should replace the whole query if a level filter already exists and shift is not pressed", () => {
    const result = buildQueryExprWithLevelFilters({
      queryExpr: "filterName1: filterValue1 level: warning",
      levelQueryExpr: "level: error",
      isUnknownFilter: false,
      isShiftPressed: false,
    });
    expect(result).toBe("level: error");
  });

  it("should append the level query when multiple filters are piped and no level filter exists", () => {
    const result = buildQueryExprWithLevelFilters({
      queryExpr: "filterName1: filterValue1 | filterName2: filterValue2",
      levelQueryExpr: "level: debug",
      isUnknownFilter: false,
      isShiftPressed: false,
    });
    expect(result).toBe("level: debug | filterName1: filterValue1 | filterName2: filterValue2");
  });

  it("should handle unknown filters appropriately if isUnknownFilter is true", () => {
    const result = buildQueryExprWithLevelFilters({
      queryExpr: "filterName1: filterValue1",
      levelQueryExpr: "level: unknown",
      isUnknownFilter: true,
      isShiftPressed: false,
    });
    expect(result).toBe("level: unknown | filterName1: filterValue1");
  });


  it("should replace current level filter by unknown filter even if the shift is pressed", () => {
    const result = buildQueryExprWithLevelFilters({
      queryExpr: "level: info",
      levelQueryExpr: "level: unknown",
      isUnknownFilter: true,
      isShiftPressed: true,
    });
    expect(result).toBe("level: unknown");
  });
});
