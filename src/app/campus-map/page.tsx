import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { adminAuth } from "@/lib/firebase/admin";
import CivicMapClient from "./CivicMapClient";

export const instant = false;

const COOKIE_NAME = "__session";

export default async function CampusMapPage() {
  // Force request-time rendering before Firebase verification.
  await connection();

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  let decoded;

  try {
    decoded = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );
  } catch {
    redirect("/login");
  }

  const allowedEmails = (
    process.env.CIVICSENSE_ADMIN_EMAILS ?? ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const accountEmail = decoded.email?.trim().toLowerCase();

  if (
    !allowedEmails.length ||
    !accountEmail ||
    !allowedEmails.includes(accountEmail)
  ) {
    redirect("/dashboard");
  }

  return <CivicMapClient />;
}