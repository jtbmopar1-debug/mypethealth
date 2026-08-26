import { describe, expect, it } from "vitest";
import {
  confirmsRestockEnquiry,
  confirmsProductIdentity,
  isProductSearchRetry,
  productSearchAnchors,
  productFamilySearchAnchors,
  productStockSearchAnchors,
  normalizeShopifyResourceId,
  rejectsProductIdentity,
  productSearchTerms,
  wantsProductStockStatus,
  wantsProductSuggestion,
  wantsProductAlternatives,
  wantsRestockEnquiryStatus,
  wantsAddToCart,
  acknowledgesInStockProduct,
} from "./product-query";

describe("product catalogue query parsing", () => {
  it("recognises customers asking what to feed their pet as recommendation intent", () => {
    expect(wantsProductSuggestion("I've got a cat and I'm unsure what to feed him")).toBe(true);
  });

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
    expect(productSearchAnchors(terms)).toEqual(["1kg", "venison", "treat"]);
    expect(productFamilySearchAnchors(terms)).toEqual(["venison", "treat"]);
    expect(productStockSearchAnchors(terms)).toEqual(["1kg", "venison", "treat"]);
  });

  it("retains chew as a key stock identifier", () => {
    const terms = productSearchTerms("when will the 1kg venison chews be back in stock?");
    expect(productStockSearchAnchors(terms)).toEqual(["1kg", "venison", "chew"]);
  });

  it("uses the complete identifying phrase for other catalogue aliases", () => {
    expect(productStockSearchAnchors(productSearchTerms("when is the red 2m leash back?")))
      .toEqual(["red", "2m", "leash"]);
    expect(productStockSearchAnchors(productSearchTerms("when is the 85g salmon pouch back?")))
      .toEqual(["85g", "salmon", "pouch"]);
  });

  it("keeps a vague size-and-protein stock request broad enough to clarify", () => {
    const terms = productSearchTerms("when will the 1kg venison be back in stock?");
    expect(productStockSearchAnchors(terms)).toEqual(["venison"]);
  });

  it("requires an explicit email offer before treating a reply as consent", () => {
    const offer = "Would you like me to email All Good Petfood about this out-of-stock product?";
    expect(confirmsRestockEnquiry("yes please", offer)).toBe(true);
    expect(confirmsRestockEnquiry("yes please", "Would you like alternatives?")).toBe(false);
  });

  it("recognises confirmation only after Buddy identifies a product", () => {
    expect(confirmsProductIdentity("yes, that's it", "I found Smokey Venison Chews 1KG. Is this the product you mean?")).toBe(true);
    expect(confirmsProductIdentity("yes, that's it", "Would you like alternatives?")).toBe(false);
  });

  it("recognises rejection only after Buddy identifies a product", () => {
    const question = "I found Smokey Venison Chews 1KG. Is this the product you mean?";
    expect(rejectsProductIdentity("no", question)).toBe(true);
    expect(rejectsProductIdentity("no", "Would you like alternatives?")).toBe(false);
  });

  it("normalizes numeric and GraphQL Shopify resource IDs", () => {
    expect(normalizeShopifyResourceId("gid://shopify/Product/12345")).toBe("12345");
    expect(normalizeShopifyResourceId("12345")).toBe("12345");
    expect(normalizeShopifyResourceId(null)).toBe("");
  });

  it("recognises a request to see alternatives", () => {
    expect(wantsProductAlternatives("yes, show me similar options")).toBe(true);
    expect(wantsProductAlternatives("no thanks")).toBe(false);
  });

  it("recognises cart requests and stock acknowledgements", () => {
    expect(wantsAddToCart("yes, add it to my cart")).toBe(true);
    expect(wantsAddToCart("is it in stock?")).toBe(false);
    expect(acknowledgesInStockProduct("oh it is in stock, cool")).toBe(true);
    expect(acknowledgesInStockProduct("when is it in stock?")).toBe(false);
  });

  it("recognises a request for the enquiry audit status", () => {
    expect(wantsRestockEnquiryStatus("when was the email sent?")).toBe(true);
    expect(wantsRestockEnquiryStatus("show me treats")).toBe(false);
  });
});
