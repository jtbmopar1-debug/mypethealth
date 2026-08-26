export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  productIds?: string[];
  products?: ProductRecommendation[];
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

export interface CustomerPet {
  id: string;
  name: string;
  species: "dog" | "cat" | null;
  breed: string | null;
  ageValue: number | null;
  ageUnit: "weeks" | "months" | "years" | null;
  ageRecordedAt: string | null;
  weightKg: number | null;
  currentFoodTitle: string | null;
  knownSensitivities: string[];
  notes: string | null;
  status: "active" | "deceased" | "archived";
  deceasedAt: string | null;
  lastMentionedAt: string;
}

export interface Product {
  id: string;
  variantId?: string;
  title: string;
  description: string;
  ingredients: string[];
  price: number;
  compareAtPrice?: number;
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
  priceNote?: string;
}

export interface CustomerPurchase {
  productId: string | null;
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  productType: string | null;
  quantity: number;
  purchasedAt: string;
  unitPrice: number | null;
  currency: string | null;
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
  recommendedProductUrls?: string[];
  enabled: boolean;
  publicationStatus?: "draft" | "published" | "archived";
  lastVerifiedAt?: string | null;
  reviewAfter?: string | null;
}
