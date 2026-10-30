
import "server-only";

import { adminAuth } from "@/lib/firebase/admin";

export async function verifyFirebaseToken(
  authorization: string | null
) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing authentication token.");
  }

  const token = authorization.slice(7);

  if (!token) {
    throw new Error("Unauthorized: Empty authentication token.");
  }

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    throw new Error("Unauthorized: Invalid or expired token.");
  }
}
