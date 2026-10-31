import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const maxDuration = 30;

const updateSchema = z.object({
  complaintId: z.string().min(1).max(128),
  status: z.enum([
    "submitted",
    "under_review",
    "in_progress",
    "resolved",
    "rejected",
  ]),
});

function serializeComplaint(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    ...data,
    id,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    aiAnalyzedAt: data.aiAnalyzedAt?.toDate?.().toISOString() ?? null,
    statusUpdatedAt: data.statusUpdatedAt?.toDate?.().toISOString() ?? null,
  };
}

function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.startsWith("Unauthorized")) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  if (message.startsWith("Forbidden")) {
    return NextResponse.json({ error: "You do not have administrator access." }, { status: 403 });
  }

  if (message.includes("Admin access is not configured")) {
    return NextResponse.json({ error: "Admin access is not configured on the server." }, { status: 503 });
  }

  return null;
}

/** Return the most recent 250 complaints for the admin workspace. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request.headers.get("authorization"));

    const snapshot = await adminDb
      .collection("complaints")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    const complaints = snapshot.docs.map((doc) =>
      serializeComplaint(doc.id, doc.data()),
    );

    return NextResponse.json(
      { success: true, complaints, count: complaints.length },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;

    console.error("Admin complaint retrieval error:", error);
    return NextResponse.json(
      { error: "Unable to retrieve campus complaints." },
      { status: 500 },
    );
  }
}

/** Update a complaint status and append an immutable status-history event. */
export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request.headers.get("authorization"));

    let body: z.infer<typeof updateSchema>;
    try {
      body = updateSchema.parse(await request.json());
    } catch {
      return NextResponse.json(
        { error: "Provide a valid complaint ID and status." },
        { status: 400 },
      );
    }

    const complaintRef = adminDb.collection("complaints").doc(body.complaintId);
    let previousStatus = "submitted";
    let changed = false;

    await adminDb.runTransaction(async (transaction) => {
      const complaintSnapshot = await transaction.get(complaintRef);

      if (!complaintSnapshot.exists) {
        throw new Error("Complaint not found.");
      }

      const complaint = complaintSnapshot.data()!;
      previousStatus =
        typeof complaint.status === "string" ? complaint.status : "submitted";

      if (previousStatus === body.status) return;

      const historyRef = complaintRef.collection("statusHistory").doc();
      const now = FieldValue.serverTimestamp();

      transaction.update(complaintRef, {
        status: body.status,
        statusUpdatedAt: now,
        statusUpdatedBy: admin.uid,
        statusUpdatedByEmail: admin.email ?? null,
        updatedAt: now,
      });

      transaction.set(historyRef, {
        from: previousStatus,
        to: body.status,
        changedBy: admin.uid,
        changedByEmail: admin.email ?? null,
        createdAt: now,
      });

      changed = true;
    });

    return NextResponse.json({
      success: true,
      complaintId: body.complaintId,
      previousStatus,
      status: body.status,
      changed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const response = authErrorResponse(error);
    if (response) return response;

    if (message === "Complaint not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("Admin complaint update error:", error);
    return NextResponse.json(
      { error: "Unable to update complaint status." },
      { status: 500 },
    );
  }
}
