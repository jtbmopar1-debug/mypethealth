import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createShopifySession, exchangeShopifyCode, fetchShopifyCustomer, readShopifyFlow, shopifyCookieOptions, shopifyCustomerConfig, SHOPIFY_FLOW_COOKIE, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";

export async function GET(request: NextRequest) {
  const config = shopifyCustomerConfig();
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const oauthError = request.nextUrl.searchParams.get("error");
    if (oauthError) throw new Error(`Shopify authorization declined: ${oauthError}`);
    if (!code || !state) throw new Error("Shopify callback is missing code or state");

    const flow = readShopifyFlow(request.cookies.get(SHOPIFY_FLOW_COOKIE)?.value, state);
    const tokens = await exchangeShopifyCode(code, flow.verifier);
    const customer = await fetchShopifyCustomer(tokens.access_token);
    const maxAge = Math.min(tokens.expires_in ?? 3600, 3600);
    const session = createShopifySession({
      customerId: customer.id,
      email: customer.emailAddress?.emailAddress ?? null,
      firstName: customer.firstName,
      lastName: customer.lastName,
      idToken: tokens.id_token,
      expiresAt: Date.now() + maxAge * 1000,
    });

    const response = NextResponse.redirect(new URL("/?shopify=connected", config.appBaseUrl));
    response.cookies.delete(SHOPIFY_FLOW_COOKIE);
    response.cookies.set(SHOPIFY_SESSION_COOKIE, session, shopifyCookieOptions(maxAge));
    return response;
  } catch (error) {
    console.error("[shopify-auth] callback failed", error instanceof Error ? error.message : "Unknown error");
    const response = NextResponse.redirect(new URL("/?auth_error=shopify", config.appBaseUrl));
    response.cookies.delete(SHOPIFY_FLOW_COOKIE);
    return response;
  }
}
