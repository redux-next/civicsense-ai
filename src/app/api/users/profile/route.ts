
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
    const email = decoded.email ?? null;
    const displayName = decoded.name ?? "CivicSense User";

    const userRef = adminDb.collection("users").doc(uid);

    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);

      if (!snapshot.exists) {
        transaction.set(userRef, {
          uid,
          email,
          displayName,
          role: "student",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.update(userRef, {
          email,
          displayName,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    const profile = await userRef.get();

    return NextResponse.json({
      success: true,
      profile: {
        uid,
        email,
        displayName,
        role: profile.data()?.role ?? "student",
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
