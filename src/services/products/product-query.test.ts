import { describe, expect, it } from "vitest";
import {
  isProductSearchRetry,
  productSearchAnchors,
  productFamilySearchAnchors,
  productSearchTerms,
  wantsProductStockStatus,
  wantsProductSuggestion,
} from "./product-query";

describe("product catalogue query parsing", () => {
  it("recognises a natural looking-for request", () => {
    expect(wantsProductSuggestion("i looking for bully sticks")).toBe(true);
    expect(productSearchTerms("i looking for bully sticks")).toEqual(["bully", "stick"]);
  });

  it("extracts the query from an All Good Petfood search URL", () => {
    const url = "https://allgoodpetfood.co.nz/search?q=bully+sticks\\&options%5Bprefix%5D=last";
    expect(wantsProductSuggestion(url)).toBe(true);
    expect(productSearchTerms(url)).toEqual(["bully", "stick"]);
  });

  it("recognises catalogue retries without treating their filler as product terms", () => {
    expect(isProductSearchRetry("check the product catalogue better they are there!")).toBe(true);
    expect(productSearchTerms("check the product catalogue better they are there!")).toEqual([]);
  });

  it("keeps identifying details from a stock and future-special question", () => {
    const message = "when are you going to get the 1kg venison crunchy treats back in and will they still be on special?";
    const terms = productSearchTerms(message);
    expect(wantsProductStockStatus(message)).toBe(true);
    expect(terms).toEqual(["1kg", "venison", "crunchy", "treat"]);
    expect(productSearchAnchors(terms)).toEqual(["1kg", "venison"]);
    expect(productFamilySearchAnchors(terms)).toEqual(["venison"]);
  });
});
