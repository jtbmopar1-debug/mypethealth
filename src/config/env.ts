import "server-only";

export const serverConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN,
  shopifyStoreUrl: process.env.SHOPIFY_STORE_URL,
  shopifyStorefrontDomain: process.env.SHOPIFY_STOREFRONT_DOMAIN,
  shopifyStorefrontApiDomain: process.env.SHOPIFY_STOREFRONT_API_DOMAIN,
  shopifyStorefrontAccessToken: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
  shopifyStorefrontApiVersion: process.env.SHOPIFY_STOREFRONT_API_VERSION || "2026-07",
  shopifyAppClientId: process.env.SHOPIFY_APP_CLIENT_ID,
  shopifyAppClientSecret: process.env.SHOPIFY_APP_CLIENT_SECRET,
};
