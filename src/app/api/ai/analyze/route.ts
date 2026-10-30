
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";

import { gemini, GEMINI_MODEL } from "@/lib/gemini";
import { adminDb } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

export const maxDuration = 60;

const requestSchema = z.object({
  complaintId: z.string().min(1).max(128),
});

const analysisSchema = z.object({
  detectedLanguage: z.enum(["en", "as", "other"]),
  translatedTitle: z.string(),
  summaryEnglish: z.string().min(2),
  summaryAssamese: z.string().min(2),
  category: z.enum([
    "infrastructure",
    "electricity",
    "water",
    "sanitation",
    "cleanliness",
    "internet",
    "safety",
    "classroom_facilities",
    "hostel",
    "transport",
    "administration",
    "other",
  ]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  priorityReason: z.string(),
  recommendedDepartment: z.enum([
    "Electrical Department",
    "Civil Maintenance",
    "Water Supply Department",
    "Sanitation Department",
    "IT Support",
    "Security Department",
    "Hostel Administration",
    "Transport Department",
    "Academic Administration",
    "General Administration",
  ]),
  locationDetected: z.string(),
  imageFindings: z.string(),
  recommendedAction: z.string(),
  confidence: z.number().min(0).max(1),
});

const analysisJsonSchema = {
  type: "OBJECT",
  properties: {
    detectedLanguage: {
      type: "STRING",
      enum: ["en", "as", "other"],
    },
    translatedTitle: { type: "STRING" },
    summaryEnglish: { type: "STRING" },
    summaryAssamese: { type: "STRING" },
    category: {
      type: "STRING",
      enum: [
        "infrastructure",
        "electricity",
        "water",
        "sanitation",
        "cleanliness",
        "internet",
        "safety",
        "classroom_facilities",
        "hostel",
        "transport",
        "administration",
        "other",
      ],
    },
    priority: {
      type: "STRING",
      enum: ["low", "medium", "high", "critical"],
    },
    priorityReason: { type: "STRING" },
    recommendedDepartment: {
      type: "STRING",
      enum: [
        "Electrical Department",
        "Civil Maintenance",
        "Water Supply Department",
        "Sanitation Department",
        "IT Support",
        "Security Department",
        "Hostel Administration",
        "Transport Department",
        "Academic Administration",
        "General Administration",
      ],
    },
    locationDetected: { type: "STRING" },
    imageFindings: { type: "STRING" },
    recommendedAction: { type: "STRING" },
    confidence: { type: "NUMBER" },
  },
  required: [
    "detectedLanguage",
    "translatedTitle",
    "summaryEnglish",
    "summaryAssamese",
    "category",
    "priority",
    "priorityReason",
    "recommendedDepartment",
    "locationDetected",
    "imageFindings",
    "recommendedAction",
    "confidence",
  ],
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function getVerifiedImage(
  secureUrl: string,
): Promise<{ mimeType: string; data: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    throw new Error("Cloudinary is not configured.");
  }

  let imageUrl: URL;

  try {
    imageUrl = new URL(secureUrl);
  } catch {
    throw new Error("Invalid complaint image URL.");
  }

  if (
    imageUrl.protocol !== "https:" ||
    imageUrl.hostname !== "res.cloudinary.com" ||
    imageUrl.username ||
    imageUrl.password ||
    !imageUrl.pathname.startsWith(
      `/${cloudName}/image/upload/`,
    )
  ) {
    throw new Error("Untrusted complaint image URL.");
  }

  const response = await fetch(imageUrl.toString(), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error("Unable to retrieve the complaint image.");
  }

  const mimeType = response.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (!mimeType || !allowedImageTypes.has(mimeType)) {
    throw new Error("Unsupported complaint image format.");
  }

  const contentLength = Number(
    response.headers.get("content-length") || 0,
  );

  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error("Complaint image exceeds the 5 MB limit.");
  }

  const imageBuffer = await response.arrayBuffer();

  if (imageBuffer.byteLength === 0) {
    throw new Error("The complaint image is empty.");
  }

  if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Complaint image exceeds the 5 MB limit.");
  }

  return {
    mimeType,
    data: Buffer.from(imageBuffer).toString("base64"),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request) {
  try {
    // 1. Verify Firebase authentication.
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization"),
    );

    // 2. Validate request body.
    let body: z.infer<typeof requestSchema>;

    try {
      body = requestSchema.parse(await request.json());
    } catch {
      return NextResponse.json(
        { error: "Invalid request. Please provide a valid complaint ID." },
        { status: 400 },
      );
    }

    // 3. Fetch complaint from Firestore.
    const complaintRef = adminDb
      .collection("complaints")
      .doc(body.complaintId);

    const complaintSnapshot = await complaintRef.get();

    if (!complaintSnapshot.exists) {
      return NextResponse.json(
        { error: "Complaint not found." },
        { status: 404 },
      );
    }

    const complaint = complaintSnapshot.data()!;

    // 4. Students can analyse only their own complaints.
    if (complaint.uid !== decoded.uid) {
      return NextResponse.json(
        { error: "You cannot analyse this complaint." },
        { status: 403 },
      );
    }

    if (
      typeof complaint.title !== "string" ||
      typeof complaint.description !== "string"
    ) {
      return NextResponse.json(
        { error: "Complaint content is invalid." },
        { status: 400 },
      );
    }

    // 5. Prepare the bilingual analysis prompt.
    const prompt = `
You are CivicSense AI, a bilingual campus complaint analysis assistant
for an Indian university.

Analyse the following complaint carefully.

COMPLAINT TITLE:
${complaint.title}

COMPLAINT DESCRIPTION:
${complaint.description}

STUDENT-SELECTED LANGUAGE:
${complaint.language === "as" ? "Assamese" : "English"}

STUDENT-PROVIDED LOCATION:
${complaint.location || "Not provided"}

IMPORTANT LANGUAGE REQUIREMENTS:
- Understand Assamese and English, including natural phrasing.
- Detect the actual language used in the complaint.
- Do not assume the selected language is always correct.
- Use "as" for Assamese, "en" for English, and "other" for another language.
- Translate the title into clear English.
- Write a concise and accurate English summary.
- Write a natural Assamese summary in Assamese script (অসমীয়া লিপি).
- Never write Assamese using English transliteration.
- Preserve the actual meaning and context of the original complaint.

CLASSIFICATION REQUIREMENTS:
- Select the most relevant category from the allowed categories.
- Assess priority based on actual impact and urgency.
- Critical means an immediate threat to life or serious safety.
- High means significant disruption, damage, or an urgent operational issue.
- Medium means a genuine issue requiring attention but without immediate danger.
- Low means a minor issue or inconvenience.
- Never classify an ordinary inconvenience as critical.
- Recommend the most relevant university department.

LOCATION REQUIREMENTS:
- Never invent a location.
- Use the supplied location when appropriate.
- Return an empty string if the location cannot be identified reliably.

IMAGE REQUIREMENTS:
- If an image is supplied, describe only what is visibly supported.
- Do not claim damage or danger is certain when the image is unclear.
- If no image is supplied, return an empty string for imageFindings.

ADMINISTRATIVE REQUIREMENTS:
- Recommend a practical action for university administrators.
- Keep the recommendation realistic and relevant to a campus.
- Confidence must reflect uncertainty, especially for ambiguous Assamese.
- Confidence is an estimate, not a verified probability.
- AI recommendations are advisory. A human administrator must approve actions.

Return only the requested structured JSON.
    `.trim();

    // 6. Build Gemini input.
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: prompt }];

    // 7. Retrieve and validate optional Cloudinary image.
    if (complaint.image?.secureUrl) {
      const image = await getVerifiedImage(
        complaint.image.secureUrl,
      );

      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      });
    }

    // 8. Generate structured analysis with Gemini.
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: analysisJsonSchema,
        temperature: 0.2,
        maxOutputTokens: 1800,
      },
    });

    const outputText = response.text;

    if (!outputText) {
      throw new Error("Gemini returned an empty response.");
    }

    // 9. Parse and validate AI output.
    let parsedOutput: unknown;

    try {
      parsedOutput = JSON.parse(outputText);
    } catch {
      console.error("Gemini returned invalid JSON:", outputText);
      throw new Error("Gemini returned an invalid analysis format.");
    }

    const validation = analysisSchema.safeParse(parsedOutput);

    if (!validation.success) {
      console.error(
        "Gemini output validation failed:",
        validation.error.flatten(),
      );

      throw new Error("Gemini returned an incomplete analysis.");
    }

    const analysis = validation.data;

    // 10. Save analysis in Firestore.
    await complaintRef.update({
      category: analysis.category,
      priority: analysis.priority,
      department: analysis.recommendedDepartment,
      aiAnalysis: analysis,
      aiModel: GEMINI_MODEL,
      aiProvider: "google-gemini",
      aiAnalyzedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      complaintId: body.complaintId,
      analysis,
    });
  } catch (error) {
    const message = errorMessage(error);

    console.error("CivicSense Gemini analysis error:", {
      message,
      name: error instanceof Error ? error.name : "UnknownError",
    });

    if (message.startsWith("Unauthorized")) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    }

    if (
      message.includes("Cloudinary") ||
      message.includes("image URL") ||
      message.includes("image format") ||
      message.includes("image limit") ||
      message.includes("image is empty") ||
      message.includes("Untrusted complaint image")
    ) {
      return NextResponse.json(
        { error: "The attached image could not be validated." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "AI analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
