import "server-only";

import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

export async function requireAdmin(authorization: string | null) {
  const decoded = await verifyFirebaseToken(authorization);
  const allowedEmails = (process.env.CIVICSENSE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const accountEmail = decoded.email?.trim().toLowerCase();

  if (!allowedEmails.length) {
    throw new Error("Admin access is not configured.");
  }

  if (!accountEmail || !allowedEmails.includes(accountEmail)) {
    throw new Error("Forbidden: Admin access required.");
  }

  return decoded;
}
