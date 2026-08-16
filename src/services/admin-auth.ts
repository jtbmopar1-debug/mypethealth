import "server-only";

function adminEmails() {
  const rawValue = process.env.ADMIN_EMAIL_ADDRESSES?.trim() || process.env.ADMIN_EMAIL_ADDRESS?.trim() || "";
  return rawValue
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(email.trim().toLowerCase());
}
