import { describe, expect, it } from "vitest";
import { containsProductSearchAlias, expandProductSearchAliases, productTextMatchesSearchTerm } from "./product-search-aliases";

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

  it("detects category language from every configured alias group", () => {
    expect(["treat", "leash", "pouch", "tick"].every((term) => containsProductSearchAlias([term]))).toBe(true);
    expect(containsProductSearchAlias(["venison", "1kg"])).toBe(false);
  });

  it("matches customer wording against catalogue aliases", () => {
    expect(productTextMatchesSearchTerm("Smokey Venison Chews NEW Bulk Bag 1KG", "treat")).toBe(true);
    expect(productTextMatchesSearchTerm("Smokey Venison Chews NEW Bulk Bag 1KG", "salmon")).toBe(false);
    expect(productTextMatchesSearchTerm("Scream Xtreme Treat Tyre", "cream")).toBe(false);
  });
});
