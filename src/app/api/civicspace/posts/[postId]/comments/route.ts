
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

type Context = {
  params: Promise<{
    postId: string;
  }>;
};

const commentSchema = z.object({
  content: z.string().trim().min(1).max(1500),
  anonymous: z.boolean().default(false),
});

/**
 * GET /api/civicspace/posts/[postId]/comments
 *
 * Retrieve visible comments.
 */
export async function GET(
  request: Request,
  { params }: Context
) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const { postId } = await params;

    if (!postId || postId.length > 200) {
      return NextResponse.json(
        { error: "Invalid post ID." },
        { status: 400 }
      );
    }

    const postRef = adminDb
      .collection("communityPosts")
      .doc(postId);

    const postSnapshot = await postRef.get();

    if (!postSnapshot.exists) {
      return NextResponse.json(
        { error: "Post not found." },
        { status: 404 }
      );
    }

    if (postSnapshot.data()?.moderationStatus === "removed") {
      return NextResponse.json(
        { error: "This discussion is no longer available." },
        { status: 410 }
      );
    }

    const snapshot = await postRef
      .collection("comments")
      .orderBy("createdAt", "asc")
      .limit(100)
      .get();

    const comments = snapshot.docs
      .filter(
        (doc) => doc.data().moderationStatus !== "removed"
      )
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,

          content: data.content ?? "",

          authorName: data.anonymous
            ? "Anonymous Student"
            : data.authorName ?? "Student",

          createdAt:
            data.createdAt?.toDate?.().toISOString() ?? null,

          mine: data.authorUid === decoded.uid,
        };
      });

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    const unauthorized =
      error instanceof Error &&
      error.message.startsWith("Unauthorized");

    console.error("CivicSpace comments retrieval error:", error);

    return NextResponse.json(
      { error: "Unable to load comments." },
      { status: unauthorized ? 401 : 500 }
    );
  }
}

/**
 * POST /api/civicspace/posts/[postId]/comments
 *
 * Create a comment on a visible post.
 */
export async function POST(
  request: Request,
  { params }: Context
) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const { postId } = await params;

    if (!postId || postId.length > 200) {
      return NextResponse.json(
        { error: "Invalid post ID." },
        { status: 400 }
      );
    }

    const parsed = commentSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Comment must contain 1–1500 characters." },
        { status: 400 }
      );
    }

    const postRef = adminDb
      .collection("communityPosts")
      .doc(postId);

    const postSnapshot = await postRef.get();

    if (!postSnapshot.exists) {
      return NextResponse.json(
        { error: "Post not found." },
        { status: 404 }
      );
    }

    if (postSnapshot.data()?.moderationStatus === "removed") {
      return NextResponse.json(
        { error: "This discussion is no longer available." },
        { status: 410 }
      );
    }

    const user = await adminAuth.getUser(decoded.uid);

    const ref = await postRef
      .collection("comments")
      .add({
        content: parsed.data.content,
        anonymous: parsed.data.anonymous,

        authorUid: decoded.uid,
        authorName: user.displayName?.trim() || "Student",

        moderationStatus: "visible",

        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json(
      {
        success: true,
        commentId: ref.id,
      },
      { status: 201 }
    );
  } catch (error) {
    const unauthorized =
      error instanceof Error &&
      error.message.startsWith("Unauthorized");

    console.error("CivicSpace comment creation error:", error);

    return NextResponse.json(
      { error: "Unable to add comment." },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
