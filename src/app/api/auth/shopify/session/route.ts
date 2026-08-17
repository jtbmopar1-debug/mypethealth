import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";
import { listCustomerPets } from "@/services/pets/customer-pet-service";

export async function GET(request: NextRequest) {
  const session = readShopifySessionOrLocalDev(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
  let pets: Awaited<ReturnType<typeof listCustomerPets>> = [];
  if (session) {
    try {
      pets = await listCustomerPets(session.customerId);
    } catch {
      // Pet memory is optional while its database migration is being rolled out.
    }
  }
  return NextResponse.json(session ? {
    authenticated: true,
    customer: {
      id: session.customerId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
    },
    pets,
  } : { authenticated: false, customer: null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
