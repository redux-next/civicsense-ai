
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";
import { cloudinary } from "@/lib/cloudinary/config";

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const complaintSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(3000),
  language: z.enum(["en", "as"]),
  location: z.string().trim().max(200).optional().default(""),
  coordinates: coordinatesSchema.nullable().optional(),
  image: z
    .object({
      publicId: z.string().min(1).max(500),
    })
    .nullable()
    .optional(),
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp"];

export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const body: unknown = await request.json();
    const parsed = complaintSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid complaint details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const profileRef = adminDb.collection("users").doc(decoded.uid);
    const profileSnapshot = await profileRef.get();

    if (!profileSnapshot.exists) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 }
      );
    }

    let verifiedImage = null;

    if (parsed.data.image) {
      const expectedPrefix = `civicsense/complaints/${decoded.uid}/`;
      const publicId = parsed.data.image.publicId;

      if (!publicId.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "This image does not belong to your account." },
          { status: 403 }
        );
      }

      try {
        const resource = await cloudinary.api.resource(publicId);

        if (
          resource.public_id !== publicId ||
          resource.resource_type !== "image" ||
          !ALLOWED_FORMATS.includes(resource.format) ||
          resource.bytes > MAX_IMAGE_SIZE ||
          !resource.public_id.startsWith(expectedPrefix)
        ) {
          return NextResponse.json(
            { error: "The uploaded image is invalid." },
            { status: 400 }
          );
        }

        verifiedImage = {
          publicId: resource.public_id,
          secureUrl: resource.secure_url,
          format: resource.format,
          bytes: resource.bytes,
        };
      } catch {
        return NextResponse.json(
          { error: "Unable to verify the uploaded image." },
          { status: 400 }
        );
      }
    }

    const profile = profileSnapshot.data();
    const complaintRef = adminDb.collection("complaints").doc();

    await complaintRef.set({
      id: complaintRef.id,
      uid: decoded.uid,
      userEmail: decoded.email ?? null,
      userName: profile?.displayName ?? "CivicSense User",

      title: parsed.data.title,
      description: parsed.data.description,
      language: parsed.data.language,
      location: parsed.data.location,

      // CivicMap coordinates; null when not provided
      coordinates: parsed.data.coordinates ?? null,

      category: "uncategorized",
      priority: "normal",
      department: "unassigned",
      status: "submitted",

      // Community voting
      // Community voting
voteCount: 0,
upvoteCount: 0,
downvoteCount: 0,

      image: verifiedImage,
      aiAnalysis: null,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Complaint submitted successfully.",
        complaintId: complaintRef.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Complaint submission error:", error);

    return NextResponse.json(
      { error: "Unable to submit complaint." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const snapshot = await adminDb
      .collection("complaints")
      .where("uid", "==", decoded.uid)
      .get();

    const complaints = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          ...data,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
          updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
        };
      })
      .sort((a, b) => {
        return (
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        );
      });

    return NextResponse.json({ success: true, complaints });
  } catch (error) {
    console.error("Complaint retrieval error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve complaints." },
      { status: 500 }
    );
  }
}
