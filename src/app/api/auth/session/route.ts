import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

const COOKIE_NAME = "__session";
const EXPIRES_IN = 5 * 24 * 60 * 60 * 1000; // 5 days

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const decoded = await verifyFirebaseToken(authorization);

    const idToken = authorization!.slice(7);

    // Only accept recently authenticated Firebase sessions.
    const authTime = decoded.auth_time * 1000;

    if (Date.now() - authTime > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: "Please sign in again to create a session." },
        { status: 401 }
      );
    }

    const sessionCookie = await adminAuth.createSessionCookie(
      idToken,
      { expiresIn: EXPIRES_IN }
    );

    const response = NextResponse.json({ success: true });

    response.cookies.set(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: EXPIRES_IN / 1000,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to create authenticated session." },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}