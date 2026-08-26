export function guardPendingRecommendationCatalogueClaim(
  content: string,
  species: "dog" | "cat" | null,
  recommendationPending: boolean,
) {
  if (!species || !recommendationPending) return content;

  const hasNegativeClaim = /\b(?:no|not|don[’']t|do not|can[’']t|cannot|couldn[’']t|could not)\b/i.test(content);
  const namesSpeciesFood = new RegExp(`\\b${species}\\s+food(?:\\s+products?)?\\b`, "i").test(content);
  const soundsLikeCatalogueAvailability = /\b(?:catalog(?:ue)?|available|availability|stock|recommend)\b/i.test(content);
  if (!hasNegativeClaim || !namesSpeciesFood || !soundsLikeCatalogueAvailability) return content;

  return `I haven’t selected a food yet because I still need to narrow down what suits your ${species}. What are their age and weight, and do they have any known dietary sensitivities?`;
}
