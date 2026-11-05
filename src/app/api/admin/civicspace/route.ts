
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const maxDuration = 30;

const actionSchema = z.object({
  reportId: z.string().min(1).max(200),
  action: z.enum(["dismiss", "remove_content"]),
});

function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.startsWith("Unauthorized")) {
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 }
    );
  }

  if (message.startsWith("Forbidden")) {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  if (message.includes("Admin access is not configured")) {
    return NextResponse.json(
      { error: "Admin access is not configured on the server." },
      { status: 503 }
    );
  }

  return null;
}

function serializeDate(value: unknown) {
  const date = value as {
    toDate?: () => Date;
  } | null;

  return date?.toDate?.()?.toISOString?.() ?? null;
}

/**
 * GET /api/admin/civicspace?status=pending
 *
 * Retrieve CivicSpace moderation reports.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request.headers.get("authorization"));

    const status =
      new URL(request.url).searchParams.get("status") ?? "pending";

    if (!["pending", "resolved", "all"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid report filter." },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection("communityReports")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const reports = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const report = doc.data();

        const postRef = adminDb
          .collection("communityPosts")
          .doc(report.postId);

        const postSnapshot = await postRef.get();

        const post = postSnapshot.exists
          ? postSnapshot.data()
          : null;

        let comment = null;

        if (report.commentId && postSnapshot.exists) {
          const commentSnapshot = await postRef
            .collection("comments")
            .doc(report.commentId)
            .get();

          comment = commentSnapshot.exists
            ? commentSnapshot.data()
            : null;
        }

        return {
          id: doc.id,

          postId: report.postId ?? "",
          commentId: report.commentId ?? null,

          reporterUid: report.reporterUid ?? "",

          reason: report.reason ?? "other",
          details: report.details ?? "",

          status: report.status ?? "pending",
          resolution: report.resolution ?? null,

          createdAt: serializeDate(report.createdAt),
          reviewedAt: serializeDate(report.reviewedAt),

          targetExists: report.commentId
            ? Boolean(comment)
            : Boolean(post),

          targetType: report.commentId
            ? "comment"
            : "post",

          targetContent: report.commentId
            ? comment?.content ?? ""
            : post?.content ?? "",

          targetTitle: post?.title ?? "Unavailable post",

          targetCategory: post?.category ?? "general",

          targetAuthor: post?.anonymous
            ? "Anonymous Student"
            : post?.authorName ?? "Student",

          targetModerationStatus: report.commentId
            ? comment?.moderationStatus ?? "visible"
            : post?.moderationStatus ?? "visible",
        };
      })
    );

    const filteredReports =
      status === "all"
        ? reports
        : reports.filter((report) => report.status === status);

    return NextResponse.json(
      {
        success: true,
        reports: filteredReports,
        count: filteredReports.length,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const response = authErrorResponse(error);

    if (response) return response;

    console.error("CivicSpace admin reports error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve moderation reports." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/civicspace
 *
 * Dismiss a report or remove its reported content.
 */
export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(
      request.headers.get("authorization")
    );

    const parsed = actionSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid moderation action." },
        { status: 400 }
      );
    }

    const { reportId, action } = parsed.data;

    const reportRef = adminDb
      .collection("communityReports")
      .doc(reportId);

    await adminDb.runTransaction(async (transaction) => {
      const reportSnapshot = await transaction.get(reportRef);

      if (!reportSnapshot.exists) {
        throw new Error("REPORT_NOT_FOUND");
      }

      const report = reportSnapshot.data()!;

      if (report.status !== "pending") {
        throw new Error("REPORT_ALREADY_REVIEWED");
      }

      if (action === "remove_content") {
        const postRef = adminDb
          .collection("communityPosts")
          .doc(report.postId);

        const postSnapshot = await transaction.get(postRef);

        if (!postSnapshot.exists) {
          throw new Error("TARGET_NOT_FOUND");
        }

        if (report.commentId) {
          const commentRef = postRef
            .collection("comments")
            .doc(report.commentId);

          const commentSnapshot = await transaction.get(commentRef);

          if (!commentSnapshot.exists) {
            throw new Error("TARGET_NOT_FOUND");
          }

          transaction.update(commentRef, {
            moderationStatus: "removed",
            moderatedAt: FieldValue.serverTimestamp(),
            moderatedBy: admin.uid,
            moderationReason: report.reason ?? "other",
          });
        } else {
          transaction.update(postRef, {
            moderationStatus: "removed",
            moderatedAt: FieldValue.serverTimestamp(),
            moderatedBy: admin.uid,
            moderationReason: report.reason ?? "other",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.update(reportRef, {
        status: "resolved",
        resolution: action,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: admin.uid,
        reviewedByEmail: admin.email ?? null,
      });
    });

    return NextResponse.json({
      success: true,
      reportId,
      action,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    const response = authErrorResponse(error);

    if (response) return response;

    if (message === "REPORT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Report not found." },
        { status: 404 }
      );
    }

    if (message === "REPORT_ALREADY_REVIEWED") {
      return NextResponse.json(
        { error: "This report has already been reviewed." },
        { status: 409 }
      );
    }

    if (message === "TARGET_NOT_FOUND") {
      return NextResponse.json(
        { error: "The reported content no longer exists." },
        { status: 404 }
      );
    }

    console.error("CivicSpace moderation action error:", error);

    return NextResponse.json(
      { error: "Unable to process moderation action." },
      { status: 500 }
    );
  }
}
