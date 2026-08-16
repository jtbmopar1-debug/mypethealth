import type { Product, ProductRecommendation } from "@/types";

export interface ProductSearchOptions {
  query?: string;
  tags?: string[];
  availableOnly?: boolean;
}

export interface ProductService {
  searchProducts(options: ProductSearchOptions): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  getProductsByTag(tag: string): Promise<Product[]>;
  recommendProducts(tags: string[], limit?: number): Promise<ProductRecommendation[]>;
}
