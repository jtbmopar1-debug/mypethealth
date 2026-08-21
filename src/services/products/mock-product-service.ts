import { MOCK_PRODUCTS } from "@/data/mock-products";
import { serverConfig } from "@/config/env";
import type { ProductRecommendation } from "@/types";
import type { ProductSearchOptions, ProductService } from "./types";

export class MockProductService implements ProductService {
  private products() {
    const storeUrl = serverConfig.shopifyStoreUrl?.replace(/\/$/, "");
    return MOCK_PRODUCTS.map((product) => ({
      ...product,
      url: storeUrl ? `${storeUrl}${product.url}` : "#store-not-configured"
    }));
  }

  async searchProducts({ query = "", tags = [], availableOnly = true }: ProductSearchOptions) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.products().filter((product) => {
      if (availableOnly && product.availability !== "in_stock") return false;
      if (tags.length && !tags.some((tag) => product.tags.includes(tag))) return false;
      if (!terms.length) return true;
      const searchable = `${product.title} ${product.description} ${product.tags.join(" ")}`.toLowerCase();
      return terms.some((term) => searchable.includes(term));
    });
  }

  async getProduct(id: string) {
    return this.products().find((product) => product.id === id) ?? null;
  }

  async getProductsByTag(tag: string) {
    return this.products().filter((product) => product.availability === "in_stock" && product.tags.includes(tag));
  }

  async recommendProducts(tags: string[], limit = 2): Promise<ProductRecommendation[]> {
    const available = this.products().filter((product) => product.availability === "in_stock");
    const ranked = available
      .filter((product) => product.availability === "in_stock")
      .map((product) => ({
        product,
        score: tags.reduce((score, tag) => score + (product.tags.includes(tag) ? 1 : 0), 0)
      }))
      .sort((a, b) => b.score - a.score)
      .filter(({ score }) => tags.length === 0 || score > 0)
      .slice(0, limit);

    return ranked.map(({ product }) => ({ product, reason: "" }));
  }
}

export const productService: ProductService = new MockProductService();
