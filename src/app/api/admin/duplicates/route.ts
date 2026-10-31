
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { gemini, GEMINI_MODEL } from "@/lib/gemini";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const maxDuration = 60;

const requestSchema = z.object({
  complaintId: z.string().min(1).max(128),
});

const resultSchema = z.object({
  matches: z.array(
    z.object({
      complaintId: z.string(),
      similarity: z.number().min(0).max(1),
      reasonEnglish: z.string(),
      reasonAssamese: z.string(),
    }),
  ),
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    matches: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          complaintId: { type: "STRING" },
          similarity: { type: "NUMBER" },
          reasonEnglish: { type: "STRING" },
          reasonAssamese: { type: "STRING" },
        },
        required: [
          "complaintId",
          "similarity",
          "reasonEnglish",
          "reasonAssamese",
        ],
      },
    },
  },
  required: ["matches"],
};

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.startsWith("Unauthorized")) {
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  }

  if (message.startsWith("Forbidden")) {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  }

  if (message.includes("Admin access is not configured")) {
    return NextResponse.json(
      { error: "Admin access is not configured." },
      { status: 503 },
    );
  }

  return null;
}

export async function POST(request: Request) {
  try {
    // 1. Verify administrator access.
    await requireAdmin(request.headers.get("authorization"));

    // 2. Validate request.
    const parsedRequest = requestSchema.safeParse(
      await request.json(),
    );

    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: "A valid complaint ID is required." },
        { status: 400 },
      );
    }

    const { complaintId } = parsedRequest.data;

    // 3. Fetch the complaint being scanned.
    const complaintRef = adminDb
      .collection("complaints")
      .doc(complaintId);

    const complaintSnapshot = await complaintRef.get();

    if (!complaintSnapshot.exists) {
      return NextResponse.json(
        { error: "Complaint not found." },
        { status: 404 },
      );
    }

    const complaint = complaintSnapshot.data()!;

    if (
      typeof complaint.title !== "string" ||
      typeof complaint.description !== "string"
    ) {
      return NextResponse.json(
        { error: "Complaint content is invalid." },
        { status: 400 },
      );
    }

    // 4. Fetch all complaints.
    // Same-user reports are intentionally included.
    const snapshot = await adminDb
      .collection("complaints")
      .get();

    let excludedStatus = 0;
    let excludedInvalidContent = 0;

    const eligibleDocs = snapshot.docs
      .filter((doc) => {
        // Exclude only the complaint being scanned.
        if (doc.id === complaintId) {
          return false;
        }

        const data = doc.data();

        // Exclude resolved and rejected reports.
        const status =
          typeof data.status === "string"
            ? data.status.toLowerCase()
            : "";

        if (["resolved", "rejected"].includes(status)) {
          excludedStatus++;
          return false;
        }

        // Exclude malformed complaints.
        if (
          typeof data.title !== "string" ||
          typeof data.description !== "string"
        ) {
          excludedInvalidContent++;
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aCreatedAt = a.data().createdAt;
        const bCreatedAt = b.data().createdAt;

        const aTime =
          typeof aCreatedAt?.toMillis === "function"
            ? aCreatedAt.toMillis()
            : 0;

        const bTime =
          typeof bCreatedAt?.toMillis === "function"
            ? bCreatedAt.toMillis()
            : 0;

        return bTime - aTime;
      })
      .slice(0, 250);

    // 5. Prepare candidates for Gemini.
    const candidates = eligibleDocs.map((doc) => {
      const data = doc.data();
      const analysis = data.aiAnalysis ?? {};

      return {
        id: doc.id,
        title: data.title.slice(0, 120),
        description: data.description.slice(0, 1000),
        language:
          data.language === "as" ? "Assamese" : "English",
        location:
          typeof data.location === "string"
            ? data.location.slice(0, 200)
            : "",
        category:
          typeof data.category === "string"
            ? data.category
            : "unknown",
        summaryEnglish:
          typeof analysis.summaryEnglish === "string"
            ? analysis.summaryEnglish.slice(0, 400)
            : "",
        summaryAssamese:
          typeof analysis.summaryAssamese === "string"
            ? analysis.summaryAssamese.slice(0, 400)
            : "",
      };
    });

    // 6. Diagnostics.
    const diagnostics = {
      totalComplaintsFetched: snapshot.size,
      candidatesCompared: candidates.length,
      excludedStatus,
      excludedInvalidContent,
    };

    // 7. Handle no eligible candidates.
    if (candidates.length === 0) {
      await complaintRef.update({
        possibleDuplicates: [],
        duplicateScanAt: FieldValue.serverTimestamp(),
        duplicateScanModel: GEMINI_MODEL,
      });

      return NextResponse.json({
        success: true,
        complaintId,
        matches: [],
        diagnostics,
        message:
          "No other eligible complaints were available for comparison.",
      });
    }

    // 8. Prepare the current complaint.
    const currentAnalysis = complaint.aiAnalysis ?? {};

    const currentComplaint = {
      title: complaint.title,
      description: complaint.description,
      language:
        complaint.language === "as" ? "Assamese" : "English",
      location:
        typeof complaint.location === "string"
          ? complaint.location
          : "",
      category:
        typeof complaint.category === "string"
          ? complaint.category
          : "unknown",
      summaryEnglish:
        typeof currentAnalysis.summaryEnglish === "string"
          ? currentAnalysis.summaryEnglish
          : "",
      summaryAssamese:
        typeof currentAnalysis.summaryAssamese === "string"
          ? currentAnalysis.summaryAssamese
          : "",
    };

    // 9. Cross-language semantic comparison prompt.
    const prompt = `
You are CivicSense AI, a bilingual campus issue comparison system.

Your task is to identify whether the new complaint describes
the SAME underlying real-world campus issue as any candidate complaint.

You must understand both English and Assamese.

NEW COMPLAINT:
${JSON.stringify(currentComplaint)}

CANDIDATE COMPLAINTS:
${JSON.stringify(candidates)}

IMPORTANT RULES:

1. Understand Assamese and English, including natural Assamese phrasing.
2. Compare meaning, not just matching words.
3. Assamese and English reports can describe the same issue.
4. Compare the actual problem, physical location and context.
5. Different buildings, hostels, rooms or locations generally
   represent different issues.
6. A matching category alone is not sufficient.
7. Different reports about unrelated instances of the same
   problem are not duplicates.
8. Do not invent facts or locations.
9. Never return the new complaint itself.
10. Only return IDs from the supplied candidate list.
11. Return convincing possible duplicates with similarity >= 0.72.
12. Similarity is a semantic matching estimate, not a verified probability.
13. Write natural Assamese explanations in Assamese script.
14. If uncertain, leave the report out.
15. Do not reject a match merely because the two reports use
    different languages.
16. If both complaints refer to the same campus location and
    the same underlying incident, consider them strong matches.
17. Reports from the same student may also be duplicates.

A human administrator will make the final decision.

Return structured JSON only.
    `.trim();

    // 10. Ask Gemini to compare the reports.
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema,
        temperature: 0.1,
        maxOutputTokens: 1800,
      },
    });

    if (!response.text) {
      throw new Error(
        "Gemini returned an empty duplicate analysis.",
      );
    }

    // 11. Parse and validate Gemini response.
    let rawResult: unknown;

    try {
      rawResult = JSON.parse(response.text);
    } catch {
      throw new Error(
        "Gemini returned invalid JSON for duplicate analysis.",
      );
    }

    const validated = resultSchema.safeParse(rawResult);

    if (!validated.success) {
      throw new Error(
        "Gemini returned an invalid duplicate analysis.",
      );
    }

    // 12. Only accept IDs from the actual candidate list.
    const candidateIds = new Set(
      candidates.map((candidate) => candidate.id),
    );

    const matches = validated.data.matches
      .filter(
        (match) =>
          candidateIds.has(match.complaintId) &&
          match.complaintId !== complaintId &&
          match.similarity >= 0.72,
      )
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    // 13. Save possible matches for administrator review.
    await complaintRef.update({
      possibleDuplicates: matches.map((match) => ({
        complaintId: match.complaintId,
        similarity: match.similarity,
        reasonEnglish: match.reasonEnglish,
        reasonAssamese: match.reasonAssamese,
      })),
      duplicateScanAt: FieldValue.serverTimestamp(),
      duplicateScanModel: GEMINI_MODEL,
    });

    // 14. Return results and diagnostics.
    return NextResponse.json({
      success: true,
      complaintId,
      matches,
      diagnostics,
    });
  } catch (error) {
    const response = authError(error);

    if (response) {
      return response;
    }

    console.error(
      "CivicSense duplicate detection error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Duplicate detection failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
