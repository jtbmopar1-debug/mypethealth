import "server-only";

export const serverConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN,
  shopifyStoreUrl: process.env.SHOPIFY_STORE_URL,
};
