"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Upload, LoaderCircle, CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/firebase/client";

export interface UploadedImage {
  publicId: string;
}

interface ImageUploadProps {
  image: UploadedImage | null;
  onImageChange: (image: UploadedImage | null) => void;
}

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUpload({ image, onImageChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(file?: File) {
    if (!file) return;
    setError("");
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPG, PNG and WebP images are supported.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Image must be smaller than 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in again.");

      const signatureResponse = await fetch("/api/cloudinary/signature", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const signatureData = await signatureResponse.json();
      if (!signatureResponse.ok) {
        throw new Error(signatureData.error ?? "Upload authorization failed.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signatureData.apiKey);
      formData.append("timestamp", String(signatureData.timestamp));
      formData.append("folder", signatureData.folder);
      formData.append("public_id", signatureData.publicId);
      formData.append("signature", signatureData.signature);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
        { method: "POST", body: formData },
      );
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error?.message ?? "Cloudinary upload failed.");
      }

      setPreview(uploadData.secure_url);
      onImageChange({ publicId: uploadData.public_id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    onImageChange(null);
    setPreview("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void handleUpload(event.target.files?.[0])}
      />

      {!image ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbdccc] bg-white px-4 py-5 text-center text-xs text-[#718278] transition hover:border-[#79a88a] hover:bg-[#f5faf5] disabled:opacity-60"
        >
          {uploading ? (
            <LoaderCircle size={22} className="animate-spin text-[#4a9165]" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf3eb] text-[#4b8b61]">
              <ImagePlus size={19} />
            </span>
          )}
          <span className="font-semibold text-[#42634d]">
            {uploading ? "Uploading your photo..." : "Choose a photo to attach"}
          </span>
          <span className="text-[10px] text-[#9aa69e]">JPG, PNG or WebP · Maximum 5 MB</span>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-[#dce8dc] bg-white">
          {preview && (
            <img src={preview} alt="Complaint attachment preview" className="max-h-64 w-full object-contain" />
          )}
          <button
            type="button"
            onClick={removeImage}
            className="absolute right-3 top-3 rounded-full bg-[#173f32]/90 p-2 text-white transition hover:bg-rose-600"
            aria-label="Remove image"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 bg-[#f3f8f3] px-3 py-2.5 text-xs font-semibold text-[#36724d]">
            <CheckCircle2 size={15} /> Photo uploaded successfully
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
