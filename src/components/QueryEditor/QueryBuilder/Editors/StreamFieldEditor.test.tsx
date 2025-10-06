import { parseStreamFilterValue } from "./StreamFieldEditor";

describe("parseStreamFilterValue", () => {
    it("should parse a simple label", () => {
        const result = parseStreamFilterValue("app");
        expect(result).toEqual({ label: "app", not_in: false, values: [] });
    });

    it("should parse a label with in operator", () => {
        const result = parseStreamFilterValue("app in (nginx, foo.bar)");
        expect(result).toEqual({ label: "app", not_in: false, values: ["nginx", "foo.bar"] });
    });

    it("should parse a label with not_in operator", () => {
        const result = parseStreamFilterValue("app not_in (nginx, foo.bar)");
        expect(result).toEqual({ label: "app", not_in: true, values: ["nginx", "foo.bar"] });
    });

    it("should parse a label with regex match operator", () => {
        const result = parseStreamFilterValue("app=~\"nginx|foo\\.bar\"");
        expect(result).toEqual({ label: "app", not_in: false, values: ["nginx", "foo.bar"] });
    });

    it("should parse a label with regex not match operator", () => {
        const result = parseStreamFilterValue("app!~\"nginx|foo\\.bar\"");
        expect(result).toEqual({ label: "app", not_in: true, values: ["nginx", "foo.bar"] });
    });

    it("should handle empty value", () => {
        const result = parseStreamFilterValue("");
        expect(result).toEqual({ label: "", not_in: false, values: [] });
    });

    it("should handle complex cases with escaped characters", () => {
        const result = parseStreamFilterValue("label in (v1, v2, v3)");
        expect(result).toEqual({ label: "label", not_in: false, values: ["v1", "v2", "v3"] });
    });
});
