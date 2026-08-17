import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { callbackUrl, createShopifyFlow, shopifyCookieOptions, shopifyCustomerConfig, SHOPIFY_FLOW_COOKIE } from "@/services/shopify/customer-auth";

export async function GET(request: NextRequest) {
  try {
    const config = shopifyCustomerConfig();
    const flow = createShopifyFlow();
    const authorizationUrl = new URL(config.authorizationEndpoint);
    authorizationUrl.searchParams.set("client_id", config.clientId);
    authorizationUrl.searchParams.set("scope", "openid email customer-account-api:full");
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("redirect_uri", callbackUrl());
    authorizationUrl.searchParams.set("state", flow.state);
    authorizationUrl.searchParams.set("code_challenge", flow.challenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    if (request.nextUrl.searchParams.get("silent") === "1") {
      // Reuse an existing All Good Petfood customer-account session without
      // showing another sign-in screen. Shopify returns `login_required` when
      // no such session exists, and the callback sends that customer back to
      // the store's own login page.
      authorizationUrl.searchParams.set("prompt", "none");
    }

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(SHOPIFY_FLOW_COOKIE, flow.cookieValue, shopifyCookieOptions(10 * 60));
    return response;
  } catch (error) {
    console.error("[shopify-auth] start failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.redirect(new URL("/?auth_error=shopify_configuration", process.env.APP_BASE_URL || "http://localhost:3000"));
  }
}
