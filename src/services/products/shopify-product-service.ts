import "server-only";

import { serverConfig } from "@/config/env";
import type { Product, ProductRecommendation } from "@/types";
import type { ProductSearchOptions, ProductService } from "./types";

interface ShopifyProductNode {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  onlineStoreUrl: string | null;
  featuredImage: { url: string } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
}

interface ShopifyResponse {
  data?: { products?: { nodes: ShopifyProductNode[] } };
  errors?: { message: string }[];
}

interface AdminTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface StorefrontTokenResponse {
  data?: {
    storefrontAccessTokenCreate?: {
      storefrontAccessToken?: { accessToken: string } | null;
      userErrors?: { message: string }[];
    };
  };
  errors?: { message: string }[];
}

const PRODUCTS_QUERY = `
  query BuddyProducts($first: Int!, $query: String) {
    products(first: $first, query: $query, sortKey: TITLE) {
      nodes {
        id
        title
        description
        handle
        productType
        tags
        availableForSale
        onlineStoreUrl
        featuredImage { url }
        priceRange { minVariantPrice { amount currencyCode } }
      }
    }
  }
`;

const CREATE_STOREFRONT_TOKEN = `
  mutation CreateBuddyStorefrontToken($input: StorefrontAccessTokenInput!) {
    storefrontAccessTokenCreate(input: $input) {
      storefrontAccessToken { accessToken }
      userErrors { message }
    }
  }
`;

function toProduct(node: ShopifyProductNode): Product {
  const tags = [...new Set([
    ...node.tags,
    node.productType,
    ...node.title.split(/[^a-z0-9]+/i),
  ].map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  const storeUrl = serverConfig.shopifyStoreUrl?.replace(/\/$/, "") || "https://allgoodpetfood.co.nz";
  return {
    id: node.id,
    title: node.title,
    description: node.description || `Available from All Good Petfood: ${node.title}.`,
    ingredients: [],
    price: Number(node.priceRange.minVariantPrice.amount) || 0,
    currency: node.priceRange.minVariantPrice.currencyCode === "NZD" ? "NZD" : "NZD",
    image: node.featuredImage?.url || "/brand/buddy-paw.png",
    url: node.onlineStoreUrl || `${storeUrl}/products/${node.handle}`,
    retailer: "All Good Petfood",
    tags,
    availability: node.availableForSale ? "in_stock" : "out_of_stock",
  };
}

export class ShopifyProductService implements ProductService {
  private cache: { expiresAt: number; products: Product[] } | null = null;
  private accessTokenCache: { token: string; expiresAt: number } | null = null;
  private adminTokenCache: { token: string; expiresAt: number } | null = null;

  private configured() {
    return Boolean(serverConfig.shopifyStorefrontApiDomain && (
      serverConfig.shopifyStorefrontAccessToken
      || (serverConfig.shopifyAppClientId && serverConfig.shopifyAppClientSecret)
    ));
  }

  private async getStorefrontAccessToken() {
    if (serverConfig.shopifyStorefrontAccessToken) return serverConfig.shopifyStorefrontAccessToken;
    if (!serverConfig.shopifyAppClientId || !serverConfig.shopifyAppClientSecret || !serverConfig.shopifyStorefrontApiDomain) return null;
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now()) return this.accessTokenCache.token;

    if (!this.adminTokenCache || this.adminTokenCache.expiresAt <= Date.now()) {
      const response = await fetch(`https://${serverConfig.shopifyStorefrontApiDomain}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: serverConfig.shopifyAppClientId,
          client_secret: serverConfig.shopifyAppClientSecret,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Shopify credential exchange returned ${response.status}`);
      const result = await response.json() as AdminTokenResponse;
      if (!result.access_token) throw new Error("Shopify credential exchange returned no access token");
      this.adminTokenCache = { token: result.access_token, expiresAt: Date.now() + Math.max((result.expires_in ?? 86400) - 300, 300) * 1000 };
    }

    const response = await fetch(`https://${serverConfig.shopifyStorefrontApiDomain}/admin/api/${serverConfig.shopifyStorefrontApiVersion}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": this.adminTokenCache.token },
      body: JSON.stringify({ query: CREATE_STOREFRONT_TOKEN, variables: { input: { title: "My Pet Health Buddy" } } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Shopify Storefront token creation returned ${response.status}`);
    const result = await response.json() as StorefrontTokenResponse;
    const mutation = result.data?.storefrontAccessTokenCreate;
    const error = result.errors?.[0]?.message || mutation?.userErrors?.[0]?.message;
    if (error || !mutation?.storefrontAccessToken?.accessToken) throw new Error(error || "Shopify returned no Storefront access token");
    this.accessTokenCache = { token: mutation.storefrontAccessToken.accessToken, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
    return this.accessTokenCache.token;
  }

  private async fetchProducts(query?: string) {
    if (!this.configured()) return [];
    if (!query && this.cache && this.cache.expiresAt > Date.now()) return this.cache.products;

    const endpoint = `https://${serverConfig.shopifyStorefrontApiDomain}/api/${serverConfig.shopifyStorefrontApiVersion}/graphql.json`;
    const accessToken = await this.getStorefrontAccessToken();
    if (!accessToken) return [];
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { first: 100, query: query || null } }),
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`Shopify Storefront API returned ${response.status}`);
    const result = await response.json() as ShopifyResponse;
    if (result.errors?.length) throw new Error(result.errors[0].message);
    const products = (result.data?.products?.nodes || []).map(toProduct);
    if (!query) this.cache = { expiresAt: Date.now() + 5 * 60 * 1000, products };
    return products;
  }

  private async products() {
    try {
      return await this.fetchProducts();
    } catch (error) {
      console.error("[shopify-products] catalogue query failed", error instanceof Error ? error.message : "Unknown error");
      return [];
    }
  }

  async searchProducts({ query = "", tags = [], availableOnly = true }: ProductSearchOptions) {
    const products = query ? await this.fetchProducts(query).catch(() => []) : await this.products();
    return products.filter((product) => (!availableOnly || product.availability === "in_stock")
      && (!tags.length || tags.some((tag) => product.tags.includes(tag.toLowerCase()))));
  }

  async getProduct(id: string) {
    return (await this.products()).find((product) => product.id === id) ?? null;
  }

  async getProductsByTag(tag: string) {
    return (await this.products()).filter((product) => product.availability === "in_stock" && product.tags.includes(tag.toLowerCase()));
  }

  async recommendProducts(tags: string[], limit = 2): Promise<ProductRecommendation[]> {
    const products = (await this.products()).filter((product) => product.availability === "in_stock");
    const normalizedTags = tags.map((tag) => tag.toLowerCase());
    return products
      .map((product) => ({ product, score: normalizedTags.reduce((score, tag) => score + (product.tags.includes(tag) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score)
      .filter(({ score }) => normalizedTags.length === 0 || score > 0)
      .slice(0, limit)
      .map(({ product, score }) => ({
        product,
        reason: score > 0
          ? `Matches the ${normalizedTags.filter((tag) => product.tags.includes(tag)).join(" and ")} considerations we discussed.`
          : "Available from the All Good Petfood catalogue for comparison.",
      }));
  }
}
