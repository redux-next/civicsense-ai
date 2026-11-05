import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

const schema = z.object({
  postId: z.string().min(1).max(200),
  commentId: z.string().max(200).optional(),
  reason: z.enum([
    "spam",
    "harassment",
    "inappropriate",
    "misinformation",
    "other",
  ]),
  details: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid report." }, { status: 400 });
    }

    const { postId, commentId, reason, details } = parsed.data;
    const postRef = adminDb.collection("communityPosts").doc(postId);

    if (!(await postRef.get()).exists) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    if (commentId) {
      const comment = await postRef.collection("comments").doc(commentId).get();
      if (!comment.exists) {
        return NextResponse.json({ error: "Comment not found." }, { status: 404 });
      }
    }

    await adminDb.collection("communityReports").add({
      postId,
      commentId: commentId ?? null,
      reporterUid: decoded.uid,
      reason,
      details: details ?? "",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message.startsWith("Unauthorized");

    return NextResponse.json(
      { error: "Unable to submit report." },
      { status: unauthorized ? 401 : 500 }
    );
    
  }
}