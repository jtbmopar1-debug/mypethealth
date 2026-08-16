import "server-only";

export const serverConfig = {
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || "gpt-5-mini",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN,
  shopifyStoreUrl: process.env.SHOPIFY_STORE_URL,
};
