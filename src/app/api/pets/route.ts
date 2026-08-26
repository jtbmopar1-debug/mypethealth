import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  deleteCustomerPetProfile,
  listCustomerPets,
  saveCustomerPetProfile,
} from "@/services/pets/customer-pet-service";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";

const petIdSchema = z.string().uuid();
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable();
const petSchema = z.object({
  name: z.string().trim().min(1).max(80),
  species: z.enum(["dog", "cat"]).nullable(),
  breed: optionalText(120),
  ageValue: z.number().nonnegative().max(100).nullable(),
  ageUnit: z.enum(["weeks", "months", "years"]).nullable(),
  weightKg: z.number().positive().max(500).nullable(),
  currentFoodTitle: optionalText(500),
  knownSensitivities: z.array(z.string().trim().min(1).max(80)).max(20),
  notes: optionalText(4000),
  status: z.enum(["active", "deceased", "archived"]),
}).refine((pet) => pet.ageValue === null || pet.ageUnit !== null, {
  message: "Age unit is required when an age is provided",
  path: ["ageUnit"],
});

function customer(request: NextRequest) {
  return readShopifySessionOrLocalDev(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });
  try {
    return Response.json({ pets: await listCustomerPets(session.customerId) });
  } catch (error) {
    console.error("[pets] list failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Pet profiles are unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });
  const parsed = petSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Please check the pet profile details" }, { status: 400 });
  try {
    return Response.json({ pets: await saveCustomerPetProfile(session.customerId, parsed.data) });
  } catch (error) {
    console.error("[pets] create failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "That pet profile could not be saved" }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });
  const parsed = z.object({ id: petIdSchema, pet: petSchema }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Please check the pet profile details" }, { status: 400 });
  try {
    return Response.json({
      pets: await saveCustomerPetProfile(session.customerId, parsed.data.pet, parsed.data.id),
    });
  } catch (error) {
    console.error("[pets] update failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "That pet profile could not be updated" }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });
  const parsedId = petIdSchema.safeParse(request.nextUrl.searchParams.get("id"));
  if (!parsedId.success) return Response.json({ error: "Invalid pet profile ID" }, { status: 400 });
  try {
    return Response.json({ pets: await deleteCustomerPetProfile(session.customerId, parsedId.data) });
  } catch (error) {
    console.error("[pets] delete failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "That pet profile could not be deleted" }, { status: 503 });
  }
}
