import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

export const maxDuration = 30;

const imageSchema = z.object({
  url: z.string().url().refine(
    (value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          url.hostname === "res.cloudinary.com"
        );
      } catch {
        return false;
      }
    },
    "Invalid Cloudinary image URL."
  ),
  publicId: z.string().min(1).max(250),
});

const postSchema = z.object({
  title: z.string().trim().min(5).max(140),
  content: z.string().trim().min(10).max(5000),
  category: z.enum([
    "general",
    "academics",
    "events",
    "hostel",
    "technology",
    "opportunities",
    "questions",
  ]),
  anonymous: z.boolean().default(false),
  images: z.array(imageSchema).max(4).default([]),
});

function getErrorStatus(error: unknown) {
  return error instanceof Error &&
    error.message.startsWith("Unauthorized")
    ? 401
    : 500;
}

export async function GET(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const sort = new URL(request.url).searchParams.get("sort");

    const snapshot = await adminDb
      .collection("communityPosts")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const visibleDocs = snapshot.docs.filter(
      (doc) => doc.data().moderationStatus !== "removed"
    );

    const posts = await Promise.all(
      visibleDocs.map(async (doc) => {
        const data = doc.data();

        const [voteSnapshot, commentSnapshot] = await Promise.all([
          doc.ref.collection("votes").doc(decoded.uid).get(),
          doc.ref.collection("comments").count().get(),
        ]);

        return {
          id: doc.id,
          title: data.title ?? "",
          content: data.content ?? "",
          category: data.category ?? "general",
          anonymous: Boolean(data.anonymous),
          authorName: data.anonymous
            ? "Anonymous Student"
            : data.authorName ?? "Student",
          images: Array.isArray(data.images)
            ? data.images.filter(
                (image: { url?: unknown; publicId?: unknown }) =>
                  typeof image.url === "string" &&
                  typeof image.publicId === "string"
              )
            : [],
          score: Number(data.score ?? 0),
          upvotes: Number(data.upvotes ?? 0),
          downvotes: Number(data.downvotes ?? 0),
          myVote: Number(voteSnapshot.data()?.value ?? 0),
          commentCount: commentSnapshot.data().count,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
        };
      })
    );

    const sorted =
      sort === "popular"
        ? posts.sort((a, b) => b.score - a.score)
        : posts;

    return NextResponse.json(
      { success: true, posts: sorted },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("CivicSpace feed error:", error);

    return NextResponse.json(
      { error: "Unable to load discussions." },
      { status: getErrorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const parsed = postSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the post details and image attachments." },
        { status: 400 }
      );
    }

    const {
      title,
      content,
      category,
      anonymous,
      images,
    } = parsed.data;

    const expectedFolder = `civicsense/community/${decoded.uid}`;

    for (const image of images) {
      if (!image.publicId.startsWith(`${expectedFolder}/`) &&
          !image.publicId.startsWith(`${expectedFolder}_`)) {
        return NextResponse.json(
          { error: "An image does not belong to your upload folder." },
          { status: 400 }
        );
      }
    }

    const userRecord = await adminAuth.getUser(decoded.uid);

    const authorName = (
      userRecord.displayName?.trim() || "Student"
    ).slice(0, 60);

    const ref = await adminDb
      .collection("communityPosts")
      .add({
        title,
        content,
        category,
        anonymous,
        images,
        authorUid: decoded.uid,
        authorName,
        score: 0,
        upvotes: 0,
        downvotes: 0,
        moderationStatus: "visible",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json(
      { success: true, postId: ref.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("CivicSpace post creation error:", error);

    return NextResponse.json(
      { error: "Unable to create your post." },
      { status: getErrorStatus(error) }
    );
  }
}