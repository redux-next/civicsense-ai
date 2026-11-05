import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

type Context = {
  params: Promise<{ postId: string }>;
};

export async function POST(request: Request, { params }: Context) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const { postId } = await params;
    const body = await request.json();

    if (!postId || postId.length > 200 ||
        ![1, -1, 0].includes(body.value)) {
      return NextResponse.json(
        { error: "Invalid vote." },
        { status: 400 }
      );
    }

    const postRef = adminDb.collection("communityPosts").doc(postId);
    const voteRef = postRef.collection("votes").doc(decoded.uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const postSnap = await tx.get(postRef);
      if (!postSnap.exists) throw new Error("POST_NOT_FOUND");

      const voteSnap = await tx.get(voteRef);
      const post = postSnap.data()!;

      const oldVote = voteSnap.exists
        ? Number(voteSnap.data()?.value ?? 0)
        : 0;

      const nextVote = oldVote === body.value ? 0 : body.value;

      let upvotes = Number(post.upvotes ?? 0);
      let downvotes = Number(post.downvotes ?? 0);

      if (oldVote === 1) upvotes--;
      if (oldVote === -1) downvotes--;
      if (nextVote === 1) upvotes++;
      if (nextVote === -1) downvotes++;

      upvotes = Math.max(0, upvotes);
      downvotes = Math.max(0, downvotes);

      tx.update(postRef, {
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (nextVote === 0) {
        if (voteSnap.exists) tx.delete(voteRef);
      } else {
        tx.set(voteRef, {
          value: nextVote,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return { myVote: nextVote, upvotes, downvotes, score: upvotes - downvotes };
    });

    return NextResponse.json(result);
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message.startsWith("Unauthorized");

    return NextResponse.json(
      { error: unauthorized ? "Please sign in again." : "Unable to save vote." },
      { status: unauthorized ? 401 : 500 }
    );
  }
}