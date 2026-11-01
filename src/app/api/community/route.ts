
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

export async function GET(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const snapshot = await adminDb
      .collection("complaints")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const complaints = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        const voteSnapshot = await doc.ref
          .collection("votes")
          .doc(decoded.uid)
          .get();

        const myVote = voteSnapshot.exists
          ? Number(voteSnapshot.data()?.value ?? 0)
          : 0;

        return {
          id: doc.id,
          title: data.title ?? "",
          description: data.description ?? "",
          language: data.language ?? "en",
          location: data.location ?? "",
          category: data.category ?? "uncategorized",
          priority: data.priority ?? "normal",
          department: data.department ?? "unassigned",
          status: data.status ?? "submitted",
          image: data.image?.secureUrl
            ? { secureUrl: data.image.secureUrl }
            : null,
          voteCount: data.voteCount ?? 0,
          upvoteCount: data.upvoteCount ?? 0,
          downvoteCount: data.downvoteCount ?? 0,
          myVote,
          createdAt:
            data.createdAt?.toDate?.().toISOString() ?? null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      complaints,
    });
    } catch (error) {
    unstable_rethrow(error);

    console.error("Community retrieval error:", error);

    const unauthorized =
      error instanceof Error &&
      error.message.startsWith("Unauthorized");

    return NextResponse.json(
      { error: "Unable to retrieve community complaints." },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
