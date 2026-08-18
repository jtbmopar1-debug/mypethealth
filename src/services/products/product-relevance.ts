import type { Product } from "@/types";

export function productMatchesSpecies(product: Product, species: "dog" | "cat" | null) {
  if (!species) return true;
  const searchable = `${product.title} ${product.description} ${product.tags.join(" ")}`;
  const mentionsDog = /\b(?:dog|dogs|puppy|puppies|pup|canine)\b/i.test(searchable);
  const mentionsCat = /\b(?:cat|cats|kitten|kittens|feline)\b/i.test(searchable);

  // Species-neutral products can remain candidates, but an explicitly
  // dog-only item must never be shown for a cat (or vice versa).
  return species === "cat"
    ? !mentionsDog || mentionsCat
    : !mentionsCat || mentionsDog;
}
