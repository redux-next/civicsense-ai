
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { cloudinary } from "@/lib/cloudinary/config";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!apiSecret || !apiKey || !cloudName) {
      throw new Error("Cloudinary configuration is incomplete.");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `civicsense/community/${decoded.uid}`;
    const publicId = randomUUID();

    const params = {
      timestamp,
      folder,
      public_id: publicId,
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      apiSecret
    );

    return NextResponse.json({
      success: true,
      timestamp,
      folder,
      publicId,
      signature,
      apiKey,
      cloudName,
    });
  } catch (error) {
    console.error("CivicSpace upload signature error:", error);

    return NextResponse.json(
      { error: "Unable to authorize image upload." },
      { status: 401 }
    );
  }
}
