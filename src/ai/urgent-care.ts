export function urgentCareReply(message: string): string | null {
  if (/\b(?:can't breathe|cannot breathe|struggling to breathe|difficulty breathing|has collapsed|is choking|swallowed poison|ate (?:rat poison|antifreeze)|unconscious)\b/i.test(message)) {
    return "This could be an emergency. Contact a veterinarian or emergency veterinary clinic now. Don't wait for a food recommendation or a reply from the shop.";
  }
  return null;
}
