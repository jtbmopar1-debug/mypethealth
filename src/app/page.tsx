import { ChatWidget } from "@/components/chat-widget";

export default function Home() {
  const allGoodLoginUrl = "/api/auth/shopify/start?silent=1&returnTo=%2F";
  return <ChatWidget allGoodLoginUrl={allGoodLoginUrl} />;
}
