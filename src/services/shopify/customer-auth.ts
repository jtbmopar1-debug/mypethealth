import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const SHOPIFY_FLOW_COOKIE = "mph_shopify_oauth";
export const SHOPIFY_SESSION_COOKIE = "mph_shopify_session";

const flowSchema = z.object({
  state: z.string().min(20),
  verifier: z.string().min(40),
  createdAt: z.number(),
});

const sessionSchema = z.object({
  customerId: z.string().min(1),
  email: z.string().email().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  idToken: z.string().min(1),
  accessToken: z.string().min(1).optional(),
  expiresAt: z.number(),
});

export type ShopifyCustomerSession = z.infer<typeof sessionSchema>;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required Shopify setting: ${name}`);
  return value;
}

function httpsUrl(name: string) {
  const value = required(name);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return url;
}

export function shopifyCustomerConfig() {
  const storefrontDomain = required("SHOPIFY_STOREFRONT_DOMAIN");
  if (!/^[a-z0-9.-]+$/i.test(storefrontDomain)) throw new Error("SHOPIFY_STOREFRONT_DOMAIN must be a hostname");

  return {
    appBaseUrl: httpsUrl("APP_BASE_URL"),
    storefrontDomain,
    clientId: required("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID"),
    clientSecret: required("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET"),
    sessionSecret: required("SHOPIFY_SESSION_SECRET"),
    authorizationEndpoint: httpsUrl("SHOPIFY_CUSTOMER_ACCOUNT_AUTHORIZATION_ENDPOINT"),
    tokenEndpoint: httpsUrl("SHOPIFY_CUSTOMER_ACCOUNT_TOKEN_ENDPOINT"),
    logoutEndpoint: httpsUrl("SHOPIFY_CUSTOMER_ACCOUNT_LOGOUT_ENDPOINT"),
  };
}

function encryptionKey() {
  const secret = shopifyCustomerConfig().sessionSecret;
  if (secret.length < 32) throw new Error("SHOPIFY_SESSION_SECRET must be at least 32 characters");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted Shopify session");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8")) as unknown;
}

export function createShopifyFlow() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return {
    state,
    challenge,
    cookieValue: encrypt({ state, verifier, createdAt: Date.now() }),
  };
}

export function readShopifyFlow(cookieValue: string | undefined, returnedState: string) {
  if (!cookieValue) throw new Error("Shopify login session is missing or expired");
  const flow = flowSchema.parse(decrypt(cookieValue));
  if (Date.now() - flow.createdAt > 10 * 60 * 1000) throw new Error("Shopify login session expired");
  const expected = Buffer.from(flow.state);
  const actual = Buffer.from(returnedState);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("Invalid Shopify login state");
  return flow;
}

export function createShopifySession(value: ShopifyCustomerSession) {
  return encrypt(sessionSchema.parse(value));
}

export function readShopifySession(cookieValue: string | undefined) {
  if (!cookieValue) return null;
  try {
    const session = sessionSchema.parse(decrypt(cookieValue));
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

/**
 * Allows the complete authenticated experience to be exercised with `next dev`.
 * This can never activate in a production build, even if the environment flag
 * is accidentally copied to Vercel.
 */
export function readShopifySessionOrLocalDev(cookieValue: string | undefined) {
  const session = readShopifySession(cookieValue);
  if (session) return session;
  if (process.env.NODE_ENV !== "development" || process.env.LOCAL_DEV_AUTH_BYPASS === "false") return null;

  const adminEmail = (process.env.ADMIN_EMAIL_ADDRESSES || process.env.ADMIN_EMAIL_ADDRESS || "")
    .split(",")
    .map((email) => email.trim())
    .find(Boolean);

  return {
    customerId: "gid://shopify/Customer/local-development",
    email: process.env.LOCAL_DEV_CUSTOMER_EMAIL?.trim() || adminEmail || "local-dev@allgoodpetfood.co.nz",
    firstName: "Local",
    lastName: "Tester",
    idToken: "local-development-only",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  } satisfies ShopifyCustomerSession;
}

export function callbackUrl() {
  return new URL("/api/auth/shopify/callback", shopifyCustomerConfig().appBaseUrl).toString();
}

export function shopifyStorefrontLoginUrl() {
  const { storefrontDomain } = shopifyCustomerConfig();
  const loginUrl = new URL("/customer_authentication/login", `https://${storefrontDomain}`);
  const configuredReturnPath = process.env.SHOPIFY_BUDDY_RETURN_PATH?.trim() || "/";
  const returnPath = configuredReturnPath.startsWith("/") && !configuredReturnPath.startsWith("//")
    ? configuredReturnPath
    : "/";
  // Shopify only accepts a relative storefront path here. After signing in,
  // customers can return to a small Shopify Buddy launch page, which sends
  // them back through the silent My Pet Health session handoff.
  loginUrl.searchParams.set("return_to", returnPath);
  return loginUrl;
}

export function shopifyCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function exchangeShopifyCode(code: string, verifier: string) {
  const config = shopifyCustomerConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      redirect_uri: callbackUrl(),
      code,
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Shopify token exchange failed (${response.status})`);
  return z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    id_token: z.string().min(1),
    expires_in: z.number().positive().optional(),
  }).parse(await response.json());
}

export async function customerAccountGraphqlEndpoint() {
  const { storefrontDomain } = shopifyCustomerConfig();
  const discovery = await fetch(`https://${storefrontDomain}/.well-known/customer-account-api`, { cache: "no-store" });
  if (!discovery.ok) throw new Error(`Shopify API discovery failed (${discovery.status})`);
  const { graphql_api: graphqlApi } = z.object({ graphql_api: z.string().url() }).parse(await discovery.json());
  return graphqlApi;
}

export async function fetchShopifyCustomer(accessToken: string) {
  const graphqlApi = await customerAccountGraphqlEndpoint();
  const response = await fetch(graphqlApi, {
    method: "POST",
    headers: { Authorization: accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query CurrentCustomer { customer { id firstName lastName emailAddress { emailAddress } } }",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Shopify customer query failed (${response.status})`);
  const result = z.object({
    data: z.object({
      customer: z.object({
        id: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        emailAddress: z.object({ emailAddress: z.string().email() }).nullable(),
      }).nullable(),
    }).optional(),
    errors: z.array(z.object({ message: z.string() })).optional(),
  }).parse(await response.json());
  if (!result.data?.customer) throw new Error(result.errors?.[0]?.message || "Shopify did not return a customer");
  return result.data.customer;
}
