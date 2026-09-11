import { ChatWidget } from "@/components/chat-widget";
import { shopifyStorefrontLoginUrl } from "@/services/shopify/customer-auth";

export default function Home() {
  let allGoodLoginUrl = "https://allgoodpetfood.co.nz/account/login";
  try {
    allGoodLoginUrl = shopifyStorefrontLoginUrl().toString();
  } catch {
    // Guest access must remain available even while optional account
    // integration is not configured in a particular environment.
  }
  return <ChatWidget allGoodLoginUrl={allGoodLoginUrl} />;
}
