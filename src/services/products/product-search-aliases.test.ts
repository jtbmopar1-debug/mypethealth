import { describe, expect, it } from "vitest";
import { expandProductSearchAliases } from "./product-search-aliases";

describe("expandProductSearchAliases", () => {
  it("expands treat language into common catalogue names", () => {
    const terms = expandProductSearchAliases(["treat"]);
    expect(terms).toEqual(expect.arrayContaining([
      "treat", "chew", "ear", "bite", "snack", "jerky", "marshmallow",
    ]));
  });

  it("expands from either direction and retains specific terms", () => {
    const terms = expandProductSearchAliases(["ear", "venison"]);
    expect(terms).toEqual(expect.arrayContaining(["treat", "chew", "ear", "venison"]));
  });

  it("does not add unrelated alias groups", () => {
    expect(expandProductSearchAliases(["salmon"])).toEqual(["salmon"]);
  });
});
