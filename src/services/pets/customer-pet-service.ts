import "server-only";

import type { CustomerPet } from "@/types";
import { getServerSupabaseClient } from "@/services/supabase/server";
import { appearsToIntroduceNewPet, explicitlyRequestsPetSave, namedPets } from "./pet-message-parser";

interface CustomerPetRow {
  id: string;
  name: string;
  species: "dog" | "cat" | null;
  breed: string | null;
  age_value: number | null;
  age_unit: "weeks" | "months" | "years" | null;
  age_recorded_at: string | null;
  weight_kg: number | null;
  current_food_title: string | null;
  known_sensitivities: string[];
  notes: string | null;
  status: "active" | "deceased" | "archived";
  deceased_at: string | null;
  last_mentioned_at: string;
}

export interface CustomerPetInput {
  name: string;
  species: CustomerPet["species"];
  breed: string | null;
  ageValue: number | null;
  ageUnit: CustomerPet["ageUnit"];
  weightKg: number | null;
  currentFoodTitle: string | null;
  knownSensitivities: string[];
  notes: string | null;
  status: CustomerPet["status"];
}

export interface ProposedCustomerPet {
  name: string;
  species: CustomerPet["species"];
  breed: string | null;
  ageValue: number | null;
  ageUnit: CustomerPet["ageUnit"];
  weightKg: number | null;
  currentFoodTitle: string | null;
  knownSensitivities: string[];
  notes: string | null;
}

export interface PetMemoryResult {
  pets: CustomerPet[];
  proposedPets: ProposedCustomerPet[];
  savedPetNames: string[];
  updatedPetNames: string[];
}

type ExistingPetSnapshot = Pick<CustomerPetRow, "age_value" | "age_unit" | "age_recorded_at" | "status" | "deceased_at">;

function fromRow(row: CustomerPetRow): CustomerPet {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    ageValue: row.age_value,
    ageUnit: row.age_unit,
    ageRecordedAt: row.age_recorded_at,
    weightKg: row.weight_kg,
    currentFoodTitle: row.current_food_title,
    knownSensitivities: row.known_sensitivities,
    notes: row.notes,
    status: row.status,
    deceasedAt: row.deceased_at,
    lastMentionedAt: row.last_mentioned_at,
  };
}

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function reportsLoss(message: string) {
  return /\b(?:passed away|has passed|died|has died|is dead|put (?:him|her|them|my (?:dog|cat|pet)) to sleep|lost (?:him|her|them|my (?:dog|cat|pet)))\b/i.test(message);
}

function reportsAliveCorrection(message: string) {
  return /\b(?:is alive|did not die|didn't die|is not dead|isn't dead)\b/i.test(message);
}

function profileFacts(message: string) {
  const explicitAgeMatch = message.match(/\b(\d+(?:\.\d+)?)\s*(weeks?|wks?|months?|mths?|mos?|years?|yrs?|yo)\s*(?:old)?\b/i);
  const ageWithoutUnitMatch = message.match(/\b(?:he|she|they|it|[A-Za-z][A-Za-z'-]{0,39})\s+(?:is|was)\s+(\d{1,2})(?!\s*(?:kg|weeks?|wks?|months?|mths?|mos?|years?|yrs?|yo))\b/i);
  const ageMatch = explicitAgeMatch ?? ageWithoutUnitMatch;
  const weightMatch = message.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b/i);
  const explicitBreed = message.match(/\b(american staffy|american staffordshire terrier|staffordshire bull terrier|staffy|labrador|golden retriever|german shepherd|border collie|cavoodle|poodle|pomeranian|japanese spitz|chihuahua|jack russell|shih tzu|rottweiler|greyhound|beagle|bulldog|french bulldog|pug|maine coon|ragdoll|burmese|siamese|domestic short ?hair|domestic long ?hair)\b/i);
  const foodMatch = message.match(/\b(?:currently (?:eating|on)|current food is|eats|i (?:feed|am feeding) (?:him|her|them)?)\s+([^.!?]{2,120})/i);
  const sensitivityMatch = message.match(/\b(?:allergic|sensitive|intolerant)\s+to\s+([A-Za-z][A-Za-z -]{1,80})/i);
  const explicitlyNoSensitivities = /\b(?:no|doesn't have any|does not have any)\s+(?:known\s+)?(?:allergies|sensitivities|intolerances)\b/i.test(message);
  const species = /\b(?:cat|kitten)\b/i.test(message) ? "cat" as const
    : /\b(?:dog|puppy|pup)\b/i.test(message) ? "dog" as const
      : undefined;
  const rawAgeUnit = explicitAgeMatch?.[2]?.toLowerCase();
  const ageUnit = rawAgeUnit?.startsWith("w") ? "weeks" as const
    : rawAgeUnit?.startsWith("m") ? "months" as const
      : rawAgeUnit || ageWithoutUnitMatch ? "years" as const
        : undefined;

  return {
    species,
    breed: explicitBreed?.[1] || undefined,
    ageValue: ageMatch ? Number(ageMatch[1]) : undefined,
    ageUnit,
    weightKg: weightMatch ? Number(weightMatch[1]) : undefined,
    currentFoodTitle: foodMatch?.[1]?.trim(),
    knownSensitivities: sensitivityMatch?.[1] ? [sensitivityMatch[1].trim()] : explicitlyNoSensitivities ? [] : undefined,
  };
}

export async function listCustomerPets(shopifyCustomerId: string) {
  const { data, error } = await getServerSupabaseClient()
    .from("shopify_customer_pets")
    .select("id,name,species,breed,age_value,age_unit,age_recorded_at,weight_kg,current_food_title,known_sensitivities,notes,status,deceased_at,last_mentioned_at")
    .eq("shopify_customer_id", shopifyCustomerId)
    .order("last_mentioned_at", { ascending: false });
  if (error) throw new Error(`Pet memory query failed: ${error.message}`);
  return (data as CustomerPetRow[]).map(fromRow);
}

export async function saveCustomerPetProfile(
  shopifyCustomerId: string,
  input: CustomerPetInput,
  petId?: string,
) {
  const supabase = getServerSupabaseClient();
  const now = new Date().toISOString();
  let existing: ExistingPetSnapshot | null = null;
  if (petId) {
    const { data, error } = await supabase
      .from("shopify_customer_pets")
      .select("age_value,age_unit,age_recorded_at,status,deceased_at")
      .eq("id", petId)
      .eq("shopify_customer_id", shopifyCustomerId)
      .maybeSingle();
    if (error) throw new Error(`Pet profile lookup failed: ${error.message}`);
    if (!data) throw new Error("Pet profile was not found");
    existing = data as ExistingPetSnapshot;
  }
  const ageUnchanged = existing
    && existing.age_value === input.ageValue
    && existing.age_unit === (input.ageValue === null ? null : input.ageUnit);
  const ageRecordedAt = input.ageValue === null
    ? null
    : ageUnchanged && existing ? existing.age_recorded_at : now;
  const values = {
    shopify_customer_id: shopifyCustomerId,
    name: input.name,
    species: input.species,
    breed: input.breed,
    age_value: input.ageValue,
    age_unit: input.ageValue === null ? null : input.ageUnit,
    age_recorded_at: ageRecordedAt,
    weight_kg: input.weightKg,
    current_food_title: input.currentFoodTitle,
    known_sensitivities: input.knownSensitivities,
    notes: input.notes,
    status: input.status,
    deceased_at: input.status === "deceased" ? existing?.deceased_at || now : null,
    updated_at: now,
    last_mentioned_at: now,
  };

  const query = petId
    ? supabase.from("shopify_customer_pets").update(values).eq("id", petId).eq("shopify_customer_id", shopifyCustomerId)
    : supabase.from("shopify_customer_pets").insert(values);
  const { error } = await query;
  if (error) throw new Error(`Pet profile save failed: ${error.message}`);
  return listCustomerPets(shopifyCustomerId);
}

export async function deleteCustomerPetProfile(shopifyCustomerId: string, petId: string) {
  const { error } = await getServerSupabaseClient()
    .from("shopify_customer_pets")
    .delete()
    .eq("id", petId)
    .eq("shopify_customer_id", shopifyCustomerId);
  if (error) throw new Error(`Pet profile delete failed: ${error.message}`);
  return listCustomerPets(shopifyCustomerId);
}

async function saveNamedPet(
  shopifyCustomerId: string,
  name: string,
  species: "dog" | "cat" | null,
  status: CustomerPet["status"],
  facts: Partial<ReturnType<typeof profileFacts>> = {}
) {
  const supabase = getServerSupabaseClient();
  const { data: existing, error: findError } = await supabase
    .from("shopify_customer_pets")
    .select("id,deceased_at")
    .eq("shopify_customer_id", shopifyCustomerId)
    .ilike("name", name)
    .maybeSingle();
  if (findError) throw new Error(`Pet memory lookup failed: ${findError.message}`);

  const now = new Date().toISOString();
  const values = {
    shopify_customer_id: shopifyCustomerId,
    name,
    ...(facts.species || species ? { species: facts.species || species } : {}),
    ...(facts.breed ? { breed: facts.breed } : {}),
    ...(facts.ageValue !== undefined && facts.ageUnit ? { age_value: facts.ageValue, age_unit: facts.ageUnit, age_recorded_at: now } : {}),
    ...(facts.weightKg !== undefined ? { weight_kg: facts.weightKg } : {}),
    ...(facts.currentFoodTitle ? { current_food_title: facts.currentFoodTitle } : {}),
    ...(facts.knownSensitivities !== undefined ? { known_sensitivities: facts.knownSensitivities } : {}),
    status,
    deceased_at: status === "deceased" ? existing?.deceased_at || now : null,
    updated_at: now,
    last_mentioned_at: now,
  };
  const query = existing?.id
    ? supabase.from("shopify_customer_pets").update(values).eq("id", existing.id).eq("shopify_customer_id", shopifyCustomerId)
    : supabase.from("shopify_customer_pets").insert(values);
  const { error } = await query;
  if (error) throw new Error(`Pet memory update failed: ${error.message}`);
}

export async function rememberCustomerPets(
  shopifyCustomerId: string,
  message: string,
  confirmedProposalMessage?: string,
): Promise<PetMemoryResult> {
  let existingPets = await listCustomerPets(shopifyCustomerId);
  const savedPetNames: string[] = [];
  const updatedPetNames = new Set<string>();

  if (confirmedProposalMessage) {
    const confirmedFacts = profileFacts(confirmedProposalMessage);
    const confirmedLoss = reportsLoss(confirmedProposalMessage);
    for (const pet of namedPets(confirmedProposalMessage)) {
      if (existingPets.some((existing) => existing.name.toLowerCase() === pet.name.toLowerCase())) continue;
      await saveNamedPet(shopifyCustomerId, pet.name, pet.species, confirmedLoss ? "deceased" : "active", confirmedFacts);
      savedPetNames.push(pet.name);
    }
    existingPets = await listCustomerPets(shopifyCustomerId);
  }

  const discovered = namedPets(message);
  const loss = reportsLoss(message);
  const aliveCorrection = reportsAliveCorrection(message);
  const facts = profileFacts(message);
  const hasProfileFacts = Object.values(facts).some((value) => value !== undefined);
  const proposedPets: ProposedCustomerPet[] = [];
  const explicitSaveRequest = explicitlyRequestsPetSave(message);

  for (const pet of discovered) {
    const knownPet = existingPets.find((existing) => existing.name.toLowerCase() === pet.name.toLowerCase());
    if (!knownPet) {
      if (explicitSaveRequest) {
        await saveNamedPet(shopifyCustomerId, pet.name, facts.species ?? pet.species, loss ? "deceased" : "active", facts);
        savedPetNames.push(pet.name);
        continue;
      }
      proposedPets.push({
        name: pet.name,
        species: facts.species ?? pet.species,
        breed: facts.breed ?? null,
        ageValue: facts.ageValue ?? null,
        ageUnit: facts.ageUnit ?? null,
        weightKg: facts.weightKg ?? null,
        currentFoodTitle: facts.currentFoodTitle ?? null,
        knownSensitivities: facts.knownSensitivities ?? [],
        notes: null,
      });
      continue;
    }
    const status = loss ? "deceased" : aliveCorrection ? "active" : knownPet?.status ?? "active";
    await saveNamedPet(shopifyCustomerId, knownPet.name, pet.species, status, facts);
    if (hasProfileFacts || loss || aliveCorrection) updatedPetNames.add(knownPet.name);
  }

  for (const pet of existingPets) {
    if (!new RegExp(`\\b${escaped(pet.name)}\\b`, "i").test(message)) continue;
    if (discovered.some((item) => item.name.toLowerCase() === pet.name.toLowerCase())) continue;
    if (loss) await saveNamedPet(shopifyCustomerId, pet.name, pet.species, "deceased", facts);
    else if (aliveCorrection) await saveNamedPet(shopifyCustomerId, pet.name, pet.species, "active", facts);
    else await saveNamedPet(shopifyCustomerId, pet.name, pet.species, pet.status, facts);
    if (hasProfileFacts || loss || aliveCorrection) updatedPetNames.add(pet.name);
  }

  const namedOrMentioned = discovered.length > 0 || existingPets.some((pet) => new RegExp(`\\b${escaped(pet.name)}\\b`, "i").test(message));
  const soleActivePets = existingPets.filter((pet) => pet.status === "active");
  if (!namedOrMentioned && !appearsToIntroduceNewPet(message) && soleActivePets.length === 1 && (hasProfileFacts || loss)) {
    const pet = soleActivePets[0];
    await saveNamedPet(shopifyCustomerId, pet.name, pet.species, loss ? "deceased" : pet.status, facts);
    updatedPetNames.add(pet.name);
  }

  return {
    pets: await listCustomerPets(shopifyCustomerId),
    proposedPets,
    savedPetNames,
    updatedPetNames: [...updatedPetNames],
  };
}
