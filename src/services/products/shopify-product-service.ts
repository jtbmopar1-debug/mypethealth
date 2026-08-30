import "server-only";

import { serverConfig } from "@/config/env";
import type { Product, ProductRecommendation, ProductVariant } from "@/types";
import type { ProductSearchOptions, ProductService } from "./types";
import { isPrivateCustomOrderProduct, productMatchesSpecies } from "./product-relevance";
import { expandProductSearchAliases, productTextMatchesRequiredTerm } from "./product-search-aliases";
import { productSearchAnchors } from "./product-query";

interface ShopifyProductNode {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  tags?: string[];
  availableForSale: boolean;
  selectedOrFirstAvailableVariant: {
    id: string;
    availableForSale: boolean;
    compareAtPrice: { amount: string; currencyCode: string } | null;
  } | null;
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      availableForSale: boolean;
      price: { amount: string };
      compareAtPrice: { amount: string } | null;
    }>;
  };
  onlineStoreUrl: string | null;
  featuredImage: { url: string } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
}

interface ShopifyResponse {
  data?: {
    products?: {
      nodes: ShopifyProductNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
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

interface PublicShopifyVariant {
  id: number;
  title: string;
  available: boolean;
  price: string;
  compare_at_price: string | null;
}

interface PublicShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  tags: string[] | string;
  variants: PublicShopifyVariant[];
  image: { src: string } | null;
  images?: { src: string }[];
}

interface PublicProductsResponse {
  products?: PublicShopifyProduct[];
}

interface ShopifyVariantResponse {
  data?: {
    node?: {
      id: string;
      title: string;
      availableForSale: boolean;
      price: { amount: string; currencyCode: string };
      compareAtPrice: { amount: string; currencyCode: string } | null;
      image: { url: string } | null;
      product: {
        id: string;
        title: string;
        description: string;
        handle: string;
        productType: string;
        tags: string[];
        onlineStoreUrl: string | null;
        featuredImage: { url: string } | null;
      };
    } | null;
  };
  errors?: { message: string }[];
}

const PRODUCTS_QUERY = `
  query BuddyProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      nodes {
        id
        title
        description
        handle
        productType
        availableForSale
        selectedOrFirstAvailableVariant { id availableForSale compareAtPrice { amount currencyCode } }
        variants(first: 50) { nodes { id title availableForSale price { amount } compareAtPrice { amount } } }
        onlineStoreUrl
        featuredImage { url }
        priceRange { minVariantPrice { amount currencyCode } }
      }
      pageInfo { hasNextPage endCursor }
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

const PRODUCT_VARIANT_QUERY = `
  query BuddyProductVariant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        title
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        image { url }
        product {
          id
          title
          description
          handle
          productType
          tags
          onlineStoreUrl
          featuredImage { url }
        }
      }
    }
  }
`;

let sharedAccessTokenCache: { token: string; expiresAt: number } | null = null;
let sharedAdminTokenCache: { token: string; expiresAt: number } | null = null;
let sharedPublicProductCache: { products: Product[]; expiresAt: number } | null = null;
let authenticatedCatalogueRetryAfter = 0;

function plainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPublicProduct(node: PublicShopifyProduct): Product | null {
  const variant = node.variants.find((item) => item.available) || node.variants[0];
  if (!variant) return null;
  const rawTags = Array.isArray(node.tags) ? node.tags : node.tags.split(",");
  const tags = [...new Set([
    ...rawTags,
    node.product_type,
    ...node.title.split(/[^a-z0-9]+/i),
  ].map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  const storeUrl = serverConfig.shopifyStoreUrl?.replace(/\/$/, "") || "https://allgoodpetfood.co.nz";
  return {
    id: String(node.id),
    variantId: String(variant.id),
    title: node.title,
    description: plainText(node.body_html) || `Available from All Good Petfood: ${node.title}.`,
    ingredients: [],
    price: Number(variant.price) || 0,
    compareAtPrice: variant.compare_at_price ? Number(variant.compare_at_price) || undefined : undefined,
    currency: "NZD",
    image: node.image?.src || node.images?.[0]?.src || "/brand/buddy-paw.png",
    url: `${storeUrl}/products/${node.handle}`,
    retailer: "All Good Petfood",
    tags,
    availability: variant.available ? "in_stock" : "out_of_stock",
    variants: node.variants.map((item): ProductVariant => ({
      id: String(item.id),
      title: item.title,
      price: Number(item.price) || 0,
      compareAtPrice: item.compare_at_price ? Number(item.compare_at_price) || undefined : undefined,
      availability: item.available ? "in_stock" : "out_of_stock",
    })),
  };
}

function toProduct(node: ShopifyProductNode): Product {
  const tags = [...new Set([
    ...(node.tags || []),
    node.productType,
    ...node.title.split(/[^a-z0-9]+/i),
  ].map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  const storeUrl = serverConfig.shopifyStoreUrl?.replace(/\/$/, "") || "https://allgoodpetfood.co.nz";
  return {
    id: node.id,
    variantId: node.selectedOrFirstAvailableVariant?.id,
    title: node.title,
    description: node.description || `Available from All Good Petfood: ${node.title}.`,
    ingredients: [],
    price: Number(node.priceRange.minVariantPrice.amount) || 0,
    compareAtPrice: node.selectedOrFirstAvailableVariant?.compareAtPrice
      ? Number(node.selectedOrFirstAvailableVariant.compareAtPrice.amount) || undefined
      : undefined,
    currency: node.priceRange.minVariantPrice.currencyCode === "NZD" ? "NZD" : "NZD",
    image: node.featuredImage?.url || "/brand/buddy-paw.png",
    url: node.onlineStoreUrl || `${storeUrl}/products/${node.handle}`,
    retailer: "All Good Petfood",
    tags,
    availability: node.availableForSale ? "in_stock" : "out_of_stock",
    variants: node.variants.nodes.map((variant): ProductVariant => ({
      id: variant.id,
      title: variant.title,
      price: Number(variant.price.amount) || 0,
      compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice.amount) || undefined : undefined,
      availability: variant.availableForSale ? "in_stock" : "out_of_stock",
    })),
  };
}

export class ShopifyProductService implements ProductService {
  private cache: { expiresAt: number; products: Product[] } | null = null;

  private configured() {
    return Boolean(serverConfig.shopifyStorefrontApiDomain && (
      serverConfig.shopifyStorefrontAccessToken
      || (serverConfig.shopifyAppClientId && serverConfig.shopifyAppClientSecret)
    ));
  }

  private async fetchPublicProducts(query?: string) {
    if (!sharedPublicProductCache || sharedPublicProductCache.expiresAt <= Date.now()) {
      const storeUrl = serverConfig.shopifyStoreUrl?.replace(/\/$/, "") || "https://allgoodpetfood.co.nz";
      const collected: Product[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const response = await fetch(`${storeUrl}/products.json?limit=250&page=${page}`, {
          next: { revalidate: 300 },
        });
        if (!response.ok) throw new Error(`Shopify public catalogue returned ${response.status}`);
        const batch = (await response.json() as PublicProductsResponse).products || [];
        collected.push(...batch.map(toPublicProduct).filter((product): product is Product => Boolean(product)));
        if (batch.length < 250) break;
      }
      sharedPublicProductCache = { products: collected, expiresAt: Date.now() + 5 * 60 * 1000 };
    }

    const products = sharedPublicProductCache.products;
    if (!query) return products;
    const terms = query
      .replace(/\b(?:title|tag|product_type):/gi, " ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 1);
    return products.filter((product) => {
      const searchable = `${product.title} ${product.description} ${product.tags.join(" ")}`.toLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
  }

  async getStorefrontAccessToken() {
    if (serverConfig.shopifyStorefrontAccessToken) return serverConfig.shopifyStorefrontAccessToken;
    if (!serverConfig.shopifyAppClientId || !serverConfig.shopifyAppClientSecret || !serverConfig.shopifyStorefrontApiDomain) return null;
    if (sharedAccessTokenCache && sharedAccessTokenCache.expiresAt > Date.now()) return sharedAccessTokenCache.token;

    if (!sharedAdminTokenCache || sharedAdminTokenCache.expiresAt <= Date.now()) {
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
      sharedAdminTokenCache = { token: result.access_token, expiresAt: Date.now() + Math.max((result.expires_in ?? 86400) - 300, 300) * 1000 };
    }

    const response = await fetch(`https://${serverConfig.shopifyStorefrontApiDomain}/admin/api/${serverConfig.shopifyStorefrontApiVersion}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": sharedAdminTokenCache.token },
      body: JSON.stringify({ query: CREATE_STOREFRONT_TOKEN, variables: { input: { title: "My Pet Health Buddy" } } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Shopify Storefront token creation returned ${response.status}`);
    const result = await response.json() as StorefrontTokenResponse;
    const mutation = result.data?.storefrontAccessTokenCreate;
    const error = result.errors?.[0]?.message || mutation?.userErrors?.[0]?.message;
    if (error || !mutation?.storefrontAccessToken?.accessToken) throw new Error(error || "Shopify returned no Storefront access token");
    sharedAccessTokenCache = { token: mutation.storefrontAccessToken.accessToken, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
    return sharedAccessTokenCache.token;
  }

  private async fetchProducts(query?: string) {
    if (!this.configured() || authenticatedCatalogueRetryAfter > Date.now()) return this.fetchPublicProducts(query);
    if (!query && this.cache && this.cache.expiresAt > Date.now()) return this.cache.products;
    try {
      const endpoint = `https://${serverConfig.shopifyStorefrontApiDomain}/api/${serverConfig.shopifyStorefrontApiVersion}/graphql.json`;
      const accessToken = await this.getStorefrontAccessToken();
      if (!accessToken) return this.fetchPublicProducts(query);
      const products: Product[] = [];
      let after: string | null = null;
      for (let page = 0; page < 20; page += 1) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": accessToken,
          },
          body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { first: 100, after, query: query || null } }),
          next: { revalidate: 300 },
        });
        if (!response.ok) throw new Error(`Shopify Storefront API returned ${response.status}`);
        const result = await response.json() as ShopifyResponse;
        if (result.errors?.length) throw new Error(result.errors[0].message);
        const connection = result.data?.products;
        products.push(...(connection?.nodes || []).map(toProduct));
        if (!connection?.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break;
        after = connection.pageInfo.endCursor;
      }
      if (!query) this.cache = { expiresAt: Date.now() + 5 * 60 * 1000, products };
      return products;
    } catch (error) {
      authenticatedCatalogueRetryAfter = Date.now() + 5 * 60 * 1000;
      console.warn("[shopify-products] authenticated catalogue unavailable; using public catalogue", error instanceof Error ? error.message : "Unknown error");
      return this.fetchPublicProducts(query);
    }
  }

  private async products() {
    try {
      // The public feed is the canonical customer-visible catalogue. It is
      // paged through to completion and includes the descriptions and tags
      // needed for reliable matching. Storefront API publications can expose
      // a smaller subset and previously made products effectively invisible.
      return await this.fetchPublicProducts();
    } catch (error) {
      console.error("[shopify-products] catalogue query failed", error instanceof Error ? error.message : "Unknown error");
      return [];
    }
  }

  async searchProducts({ query = "", tags = [], availableOnly = true }: ProductSearchOptions) {
    const products = query ? await this.fetchProducts(query).catch(() => []) : await this.products();
    return products.filter((product) => !isPrivateCustomOrderProduct(product)
      && (!availableOnly || product.availability === "in_stock")
      && (!tags.length || tags.some((tag) => product.tags.includes(tag.toLowerCase()))));
  }

  async getProduct(id: string) {
    const normalizedId = id.split("/").at(-1) || id;
    return (await this.products()).find((product) => product.id === id || product.id === normalizedId) ?? null;
  }

  async getPurchasedProduct(productId: string, variantId: string | null, variantTitle: string | null) {
    if (variantId && variantId.startsWith("gid://")) {
      try {
        const accessToken = await this.getStorefrontAccessToken();
        if (accessToken && serverConfig.shopifyStorefrontApiDomain) {
          const endpoint = `https://${serverConfig.shopifyStorefrontApiDomain}/api/${serverConfig.shopifyStorefrontApiVersion}/graphql.json`;
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Storefront-Access-Token": accessToken,
            },
            body: JSON.stringify({ query: PRODUCT_VARIANT_QUERY, variables: { id: variantId } }),
            cache: "no-store",
          });
          if (!response.ok) throw new Error(`Shopify variant query returned ${response.status}`);
          const result = await response.json() as ShopifyVariantResponse;
          if (result.errors?.length) throw new Error(result.errors[0].message);
          const variant = result.data?.node;
          if (variant?.product) {
            const tags = [...new Set([
              ...variant.product.tags,
              variant.product.productType,
              ...variant.product.title.split(/[^a-z0-9]+/i),
            ].map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
            const storeUrl = serverConfig.shopifyStoreUrl?.replace(/\/$/, "") || "https://allgoodpetfood.co.nz";
            return {
              id: variant.product.id,
              variantId: variant.id,
              title: variant.title && !/^default title$/i.test(variant.title)
                ? `${variant.product.title} - ${variant.title}`
                : variant.product.title,
              description: variant.product.description || `Available from All Good Petfood: ${variant.product.title}.`,
              ingredients: [],
              price: Number(variant.price.amount) || 0,
              compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice.amount) || undefined : undefined,
              currency: "NZD" as const,
              image: variant.image?.url || variant.product.featuredImage?.url || "/brand/buddy-paw.png",
              url: variant.product.onlineStoreUrl || `${storeUrl}/products/${variant.product.handle}`,
              retailer: "All Good Petfood",
              tags,
              availability: variant.availableForSale ? "in_stock" as const : "out_of_stock" as const,
            };
          }
          return null;
        }
      } catch (error) {
        console.warn("[shopify-products] exact purchased variant unavailable", error instanceof Error ? error.message : "Unknown error");
        return null;
      }
      // Never offer a historical variant for repurchase unless its current
      // price and availability were verified live.
      return null;
    }
    const product = await this.getProduct(productId);
    if (!product) return null;
    return {
      ...product,
      // The Customer Account API supplies the exact variant that was ordered.
      // Keep it on the card so "buy again" never adds the first/default size.
      variantId: variantId || product.variantId,
      title: variantTitle && !/^default title$/i.test(variantTitle)
        ? `${product.title} - ${variantTitle}`
        : product.title,
    };
  }

  async getProductByUrl(value: string) {
    try {
      const requested = new URL(value);
      const handle = requested.pathname.match(/^\/products\/([^/]+)/)?.[1]?.toLowerCase();
      if (!handle) return null;
      return (await this.products()).filter((product) => !isPrivateCustomOrderProduct(product)).find((product) => {
        try {
          return new URL(product.url).pathname.match(/^\/products\/([^/]+)/)?.[1]?.toLowerCase() === handle;
        } catch {
          return false;
        }
      }) ?? null;
    } catch {
      return null;
    }
  }

  async getProductsByTag(tag: string) {
    return (await this.products()).filter((product) => !isPrivateCustomOrderProduct(product)
      && product.availability === "in_stock" && product.tags.includes(tag.toLowerCase()));
  }

  async recommendProducts(tags: string[], limit = 2, options: { includeTreatAddon?: boolean; availableOnly?: boolean; allowFallback?: boolean; requiredTerms?: string[]; species?: "dog" | "cat" | null } = {}): Promise<ProductRecommendation[]> {
    const products = (await this.products()).filter((product) => (
      !isPrivateCustomOrderProduct(product)
      && (options.availableOnly === false || product.availability === "in_stock")
      && productMatchesSpecies(product, options.species ?? null)
    ));
    const normalizedTags = expandProductSearchAliases(tags.map((tag) => tag.toLowerCase()).filter(Boolean));
    const requiredTerms = (options.requiredTerms || []).map((term) => term.toLowerCase()).filter(Boolean);
    const ranked = products
      .filter((product) => {
        if (requiredTerms.length === 0) return true;
        const titleAndTags = `${product.title} ${product.tags.join(" ")}`.toLowerCase();
        return requiredTerms.every((term) => productTextMatchesRequiredTerm(titleAndTags, term))
          && (!requiredTerms.includes("raw") || /\braw\b/i.test(product.title));
      })
      .map((product) => ({
        product,
        score: normalizedTags.reduce((score, tag) => {
          const titleAndTags = `${product.title} ${product.tags.join(" ")}`.toLowerCase();
          const description = product.description.toLowerCase();
          return score + (titleAndTags.includes(tag) ? 3 : description.includes(tag) ? 1 : 0);
        }, 0),
      }))
      .sort((a, b) => b.score - a.score);
    const matching = normalizedTags.length === 0 ? ranked : ranked.filter(({ score }) => score > 0);
    const wantsTreat = normalizedTags.some((tag) => /\b(?:treat|chew|ear|snack)\b/i.test(tag));
    const primaryLimit = wantsTreat ? limit : Math.max(1, limit - 1);
    const selected = (matching.length > 0 ? matching : options.allowFallback === false ? [] : ranked).slice(0, primaryLimit);
    const recommendations = selected.map(({ product }) => ({ product, reason: "" }));

    if (options.includeTreatAddon && !wantsTreat && recommendations.length < limit) {
      const species = normalizedTags.find((tag) => tag === "dog" || tag === "cat");
      const addOn = ranked.find(({ product }) => {
        if (selected.some((item) => item.product.id === product.id)) return false;
        const searchable = `${product.title} ${product.description} ${product.tags.join(" ")}`.toLowerCase();
        return /\b(?:treat|chew|ear|snack)\b/i.test(searchable) && (!species || searchable.includes(species));
      });
      if (addOn) recommendations.push({
        product: addOn.product,
        reason: "Optional treat add-on from All Good Petfood.",
      });
    }

    return recommendations;
  }

  async getSpecials(limit = 6, searchTerms: string[] = []): Promise<ProductRecommendation[]> {
    // The store prefixes promoted product titles with "SALE". Query those
    // directly so specials are not missed when the catalogue contains more
    // than the first 100 alphabetically sorted products.
    const saleTitleProducts = await this.fetchProducts("title:SALE").catch((error) => {
      console.error("[shopify-products] specials query failed", error instanceof Error ? error.message : "Unknown error");
      return [];
    });
    const allProducts = await this.products();
    const products = [...new Map([...saleTitleProducts, ...allProducts]
      .map((product) => [product.id, product])).values()];
    const requestedSpecies = searchTerms.includes("cat") ? "cat" as const
      : searchTerms.includes("dog") ? "dog" as const
      : null;
    const specials = products.filter((product) => !isPrivateCustomOrderProduct(product)
      && product.availability === "in_stock" && (
      (product.compareAtPrice !== undefined && product.compareAtPrice > product.price)
      || /\b(?:sale|special|discount)\b/i.test(`${product.title} ${product.description}`)
      || product.tags.some((tag) => /^(sale|special|specials|on-sale|discount)/i.test(tag))
    ) && productMatchesSpecies(product, requestedSpecies));
    const normalizedTerms = expandProductSearchAliases(searchTerms);
    const requiredTerms = productSearchAnchors(searchTerms);
    const rankedSpecials = specials.map((product) => {
      const titleAndTags = `${product.title} ${product.tags.join(" ")}`.toLowerCase();
      const description = product.description.toLowerCase();
      const score = normalizedTerms.reduce((total, term) => (
        total + (titleAndTags.includes(term) ? 3 : description.includes(term) ? 1 : 0)
      ), 0);
      return { product, score, titleAndTags };
    }).filter(({ score, titleAndTags }) => (normalizedTerms.length === 0 || score > 0)
      && requiredTerms.every((term) => titleAndTags.includes(term)))
      .sort((left, right) => right.score - left.score);

    return rankedSpecials.slice(0, limit).map(({ product }) => ({
      product,
      reason: product.compareAtPrice && product.compareAtPrice > product.price
        ? `On special now: was ${product.currency} ${product.compareAtPrice.toFixed(2)}.`
        : "One of this week’s All Good Petfood specials.",
    }));
  }
}
