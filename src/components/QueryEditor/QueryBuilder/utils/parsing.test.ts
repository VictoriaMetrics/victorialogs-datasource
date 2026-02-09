import { buildVisualQueryFromString } from "./parseFromString";

describe("buildVisualQueryFromString", () => {
  it("should parse a simple expression correctly", () => {
    const expr = "field:value";
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
    expect(result.query.filters.values).toEqual(["field:value"]);
    expect(result.query.pipes).toEqual([]);
  });

  it("should parse simple field expression", () => {
    const expr = "field";
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
    expect(result.query.filters.values).toEqual(["field"]);
    expect(result.query.pipes).toEqual([]);
  });

  it("should parse field.subfield with value expression", () => {
    const expr = 'field.subfield:"value"';
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
    expect(result.query.filters.values).toEqual(['field.subfield:"value"']);
    expect(result.query.pipes).toEqual([]);
  });

  it("should parse expression with quoted field and value", () => {
    const expr = '"field:subfield": "value"';
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
    expect(result.query.filters.values).toEqual(['"field:subfield": "value"']);
    expect(result.query.pipes).toEqual([]);
  });

  it("should handle complex expressions with nested parentheses", () => {
    const expr = "(field1:value1 and field2:value2) or field3:value3";
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
    expect(result.query.filters).toEqual({
      operators: ["or"],
      values: [
        { operators: ["and"], values: ["field1:value1", "field2:value2"] },
        "field3:value3"
      ],
    });
    expect(result.query.pipes).toEqual([]);
  });

  it("should handle expressions with quotes correctly", () => {
    const expr = 'field: "value with spaces"';
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
    expect(result.query.filters.values).toEqual(['field: "value with spaces"']);
    expect(result.query.pipes).toEqual([]);
  });

  it("should reset errors for empty queries", () => {
    const expr = "";
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
  });

  it("should reset errors for non empty queries", () => {
    const expr = "*";
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle quoted values with parentheses and spaces", () => {
    const expr = '_msg: "(3/9) Installing libunistring (1.3-r0)"';
    const result = buildVisualQueryFromString(expr);
    expect(result.errors).toHaveLength(0);
    expect(result.query.filters.values).toEqual(['_msg: "(3/9) Installing libunistring (1.3-r0)"']);
    expect(result.query.pipes).toEqual([]);
  });
});
