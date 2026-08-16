export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  productIds?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  petProfile?: Partial<PetProfile>;
}

export interface PetProfile {
  name: string;
  species: "dog" | "cat";
  breed: string;
  age: string;
  weightKg: number;
  currentFood: string;
  knownSensitivities: string[];
  foodsTried: string[];
}

export interface Product {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  price: number;
  currency: "NZD";
  image: string;
  url: string;
  retailer: string;
  tags: string[];
  availability: "in_stock" | "out_of_stock";
}

export interface ProductRecommendation {
  product: Product;
  reason: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  followUpQuestions: string[];
  safetyNotes: string[];
  tags: string[];
  relevantProductTags: string[];
  enabled: boolean;
}
