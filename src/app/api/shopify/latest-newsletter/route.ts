import { getLatestNewsletter } from "@/services/shopify/latest-newsletter";

export async function GET() {
  try {
    return Response.json({ newsletter: await getLatestNewsletter() });
  } catch (error) {
    console.error("Latest Shopify newsletter could not be loaded", error);
    return Response.json({ error: "The latest newsletter is temporarily unavailable." }, { status: 503 });
  }
}
