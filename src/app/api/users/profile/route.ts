
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const uid = decoded.uid;
    const email = decoded.email?.trim().toLowerCase() ?? null;
    const displayName = decoded.name ?? "CivicSense User";

    if (!email) {
      return NextResponse.json(
        { error: "Your Firebase account does not have an email address." },
        { status: 403 }
      );
    }

    // Read admin emails exclusively from the server environment.
    const adminEmails = (process.env.CIVICSENSE_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    // Never accept admin privileges from client-provided data.
    const role = adminEmails.includes(email) ? "admin" : "student";

    const userRef = adminDb.collection("users").doc(uid);

    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);

      const profileData = {
        uid,
        email,
        displayName,
        role,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (!snapshot.exists) {
        transaction.set(userRef, {
          ...profileData,
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.update(userRef, profileData);
      }
    });

    return NextResponse.json({
      success: true,
      profile: {
        uid,
        email,
        displayName,
        role,
      },
    });
  } catch (error) {
    console.error("Profile API error:", error);

    return NextResponse.json(
      { error: "Unable to create or retrieve user profile." },
      { status: 401 }
    );
  }
}
