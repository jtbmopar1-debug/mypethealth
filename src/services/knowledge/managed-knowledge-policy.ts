export function managedKnowledgeUsesExactCopy(category: string) {
  return new Set(["store-information", "product-labels"]).has(category);
}
