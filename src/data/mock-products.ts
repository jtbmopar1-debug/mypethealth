import type { Product } from "@/types";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "all-good-natura-itch-buster-snapshot",
    title: "Natura Itch Buster Hypoallergenic Dog Food",
    description: "A fish-and-rice food sold by All Good Petfood for dogs with food sensitivities.",
    ingredients: ["Fish", "Rice"],
    price: 44.5,
    currency: "NZD",
    image: "/products/gentle-lamb.svg",
    url: "/products/hyp",
    retailer: "All Good Petfood",
    tags: ["adult", "fish", "hypoallergenic", "skin-support", "digestive-support", "itchy-dog"],
    availability: "in_stock"
  },
  {
    id: "all-good-natura-grain-be-gone-snapshot",
    title: "Natura Grain Be Gone Grain-Free Dog Food",
    description: "A fish-and-potato option sold by All Good Petfood for dogs needing a grain-free recipe.",
    ingredients: ["Fish", "Potato"],
    price: 49.9,
    currency: "NZD",
    image: "/products/salmon-oat.svg",
    url: "/products/gbg",
    retailer: "All Good Petfood",
    tags: ["adult", "fish", "single-protein", "grain-free", "skin-support"],
    availability: "in_stock"
  },
  {
    id: "all-good-natura-puppy-snapshot",
    title: "Natura Puppy Food",
    description: "A New Zealand-made puppy food sold by All Good Petfood for growing dogs.",
    ingredients: ["Beef", "Fish"],
    price: 36.5,
    currency: "NZD",
    image: "/products/puppy-chicken.svg",
    url: "/products/natura-puppy",
    retailer: "All Good Petfood",
    tags: ["puppy", "growth", "beef", "fish", "chicken-free"],
    availability: "in_stock"
  },
  {
    id: "all-good-natura-dental-weight-snapshot",
    title: "Natura Dental & Weight Management",
    description: "A natural adult recipe sold by All Good Petfood for dental and healthy-weight support.",
    ingredients: [],
    price: 34.5,
    currency: "NZD",
    image: "/products/senior-turkey.svg",
    url: "/products/natura-dental-weight-management",
    retailer: "All Good Petfood",
    tags: ["adult", "dental", "weight-care", "digestive-support"],
    availability: "in_stock"
  }
];
