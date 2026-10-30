
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { cloudinary } from "@/lib/cloudinary/config";
import { verifyFirebaseToken } from "@/lib/firebase/verify-token";

export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseToken(
      request.headers.get("authorization")
    );

    const timestamp = Math.floor(Date.now() / 1000);

    const folder = `civicsense/complaints/${decoded.uid}`;
    const publicId = randomUUID();

    const params = {
      timestamp,
      folder,
      public_id: publicId,
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      success: true,
      timestamp,
      folder,
      publicId,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    console.error("Cloudinary signature error:", error);

    return NextResponse.json(
      { error: "Unable to authorize image upload." },
      { status: 401 }
    );
  }
}
