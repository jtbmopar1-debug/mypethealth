import { wantsAddToCart } from "../products/product-query";

export function guestAccountFeatureRequested(message: string) {
  if (/^(?:please )?remember (?:that )?(?:my|our) (?:dog|cat|pet)\b/i.test(message)) return true;
  return /\b(?:order history|purchase history|recent orders?|previous orders?|contact (?:the|your|our) team|email (?:the|your|our) team|(?:open|view|manage|show) my pets|remember (?:my|our) pet (?:for|next))\b/i.test(message)
    || /\bsave\b[\s\S]{0,35}\b(?:pet|profile|chat|conversation|details?|information)\b/i.test(message)
    || wantsAddToCart(message);
}

export function guestAccountFeatureReply(message: string) {
  return wantsAddToCart(message)
    ? "You can order this online by selecting View product on the product card, which will take you to All Good Petfood. Sign in or create an account if you would like Buddy to retain your chat and account details."
    : "You can keep using Buddy without an account, but saving pets, retaining chats, viewing orders, and contacting the team require an All Good Petfood account.";
}
