
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

type RouteContext = {
  params: Promise<{
    complaintId: string;
  }>;
};

function getErrorStatus(error: unknown) {
  return error instanceof Error &&
    error.message.startsWith("Unauthorized")
    ? 401
    : 500;
}

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const { complaintId } = await params;

    if (!complaintId || complaintId.length > 200) {
      return NextResponse.json(
        { error: "Invalid complaint ID." },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();
    const parsed = voteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Vote must be 1, -1, or 0." },
        { status: 400 }
      );
    }

    const requestedVote = parsed.data.value;

    const complaintRef = adminDb
      .collection("complaints")
      .doc(complaintId);

    const voteRef = complaintRef
      .collection("votes")
      .doc(decoded.uid);

    const result = await adminDb.runTransaction(async (transaction) => {
      const complaintSnapshot = await transaction.get(complaintRef);

      if (!complaintSnapshot.exists) {
        throw new Error("COMPLAINT_NOT_FOUND");
      }

      const voteSnapshot = await transaction.get(voteRef);
      const complaint = complaintSnapshot.data()!;

      const previousVote = voteSnapshot.exists
        ? Number(voteSnapshot.data()?.value ?? 0)
        : 0;

      const upvotes = Math.max(
        0,
        Number(complaint.upvoteCount ?? 0)
      );

      const downvotes = Math.max(
        0,
        Number(complaint.downvoteCount ?? 0)
      );

      let nextUpvotes = upvotes;
      let nextDownvotes = downvotes;

      if (previousVote === 1) nextUpvotes--;
      if (previousVote === -1) nextDownvotes--;

      const nextVote =
        previousVote === requestedVote ? 0 : requestedVote;

      if (nextVote === 1) nextUpvotes++;
      if (nextVote === -1) nextDownvotes++;

      const netScore = nextUpvotes - nextDownvotes;

      transaction.update(complaintRef, {
        upvoteCount: nextUpvotes,
        downvoteCount: nextDownvotes,
        voteCount: netScore,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (nextVote === 0) {
        if (voteSnapshot.exists) {
          transaction.delete(voteRef);
        }
      } else {
        transaction.set(voteRef, {
          uid: decoded.uid,
          value: nextVote,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        myVote: nextVote,
        upvoteCount: nextUpvotes,
        downvoteCount: nextDownvotes,
        voteCount: netScore,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "COMPLAINT_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Complaint not found." },
        { status: 404 }
      );
    }

    console.error("Community voting error:", error);

    return NextResponse.json(
      { error: "Unable to process your vote." },
      { status: getErrorStatus(error) }
    );
  }
}
