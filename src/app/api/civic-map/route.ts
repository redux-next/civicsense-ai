import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";

interface Coordinates {
  lat: number;
  lng: number;
}

interface MapReport {
  id: string;
  coordinates: Coordinates;
  category: string;
  priority: string;
  department: string;
  status: string;
  location: string;
  voteCount: number;
  createdAt: string | null;
}

function toISOString(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();

    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return null;
}

function safeString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;

  return value.trim().slice(0, 120) || fallback;
}

function isValidCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;

  const coordinates = value as Record<string, unknown>;

  return (
    typeof coordinates.lat === "number" &&
    typeof coordinates.lng === "number" &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    coordinates.lat >= -90 &&
    coordinates.lat <= 90 &&
    coordinates.lng >= -180 &&
    coordinates.lng <= 180
  );
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request.headers.get("authorization"));

    const snapshot = await adminDb
      .collection("complaints")
      .limit(300)
      .get();

    const reports: MapReport[] = snapshot.docs.flatMap((doc) => {
      const data = doc.data();
      const coordinates = data.coordinates;

      if (!isValidCoordinates(coordinates)) return [];
      if (data.status === "rejected") return [];

      return [
        {
          id: doc.id,
          coordinates: {
            lat: Number(coordinates.lat.toFixed(4)),
            lng: Number(coordinates.lng.toFixed(4)),
          },
          category: safeString(data.category, "Other"),
          priority: safeString(data.priority, "normal"),
          department: safeString(data.department, "Unassigned"),
          status: safeString(data.status, "submitted"),
          location: safeString(data.location, "Campus location"),
          voteCount:
            typeof data.voteCount === "number" &&
            Number.isFinite(data.voteCount)
              ? Math.max(0, data.voteCount)
              : 0,
          createdAt: toISOString(data.createdAt),
        },
      ];
    });

    reports.sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    );

    return NextResponse.json(
      {
        success: true,
        reports,
        count: reports.length,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    // Preserve Next.js internal control-flow signals.
    unstable_rethrow(error);

    const message =
      error instanceof Error ? error.message : "";

    const normalizedMessage = message.toLowerCase();

    const isNotConfigured = normalizedMessage.includes(
      "admin access is not configured"
    );

    const isForbidden =
      normalizedMessage.includes("forbidden") ||
      isNotConfigured;

    const status = isNotConfigured
      ? 503
      : isForbidden
        ? 403
        : 401;

    if (status === 401) {
      console.warn("CivicMap authentication failed.");
    } else if (status === 403) {
      console.warn("CivicMap access denied.");
    } else {
      console.error("CivicMap API error:", message);
    }

    return NextResponse.json(
      {
        success: false,
        error: isNotConfigured
          ? "Administrator access is not configured."
          : isForbidden
            ? "Administrator access required."
            : "Please sign in again to continue.",
      },
      {
        status,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }
}