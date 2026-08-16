import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readShopifySession, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";

export async function GET(request: NextRequest) {
  const session = readShopifySession(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
  return NextResponse.json(session ? {
    authenticated: true,
    customer: {
      id: session.customerId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
    },
  } : { authenticated: false, customer: null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
