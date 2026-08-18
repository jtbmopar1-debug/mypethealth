import { describe, expect, it } from "vitest";
import type { Product } from "@/types";
import { productMatchesSpecies } from "./product-relevance";

function product(title: string, description = "", tags: string[] = []): Product {
  return {
    id: title,
    title,
    description,
    tags,
    ingredients: [],
    price: 1,
    currency: "NZD",
    image: "/test.png",
    url: "https://allgoodpetfood.co.nz/products/test",
    retailer: "All Good Petfood",
    availability: "in_stock",
  };
}

describe("productMatchesSpecies", () => {
  it("rejects an explicitly dog-only chew for a cat", () => {
    expect(productMatchesSpecies(product("Himalayan Dog Chew"), "cat")).toBe(false);
  });

  it("rejects an explicitly cat-only product for a dog", () => {
    expect(productMatchesSpecies(product("Chicken Cat Treats"), "dog")).toBe(false);
  });

  it("allows matching and species-neutral products", () => {
    expect(productMatchesSpecies(product("Tuna Cat Treats"), "cat")).toBe(true);
    expect(productMatchesSpecies(product("Paw Balm"), "cat")).toBe(true);
  });
});
