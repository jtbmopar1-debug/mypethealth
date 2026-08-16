import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readShopifySession, shopifyCustomerConfig, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";

export async function GET(request: NextRequest) {
  const config = shopifyCustomerConfig();
  const session = readShopifySession(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
  const destination = session ? new URL(config.logoutEndpoint) : new URL(config.appBaseUrl);
  if (session) {
    destination.searchParams.set("id_token_hint", session.idToken);
    destination.searchParams.set("post_logout_redirect_uri", config.appBaseUrl.toString());
  }
  const response = NextResponse.redirect(destination);
  response.cookies.delete(SHOPIFY_SESSION_COOKIE);
  return response;
}
