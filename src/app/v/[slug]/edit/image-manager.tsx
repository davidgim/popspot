"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MAX_GALLERY_IMAGES } from "@/lib/validation/vendor-image";

type VendorImage = {
  id: string;
  storage_path: string;
  caption: string | null;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function ImageManager({
  vendorId,
  avatarUrl,
  coverUrl,
  images,
}: {
  vendorId: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  images: VendorImage[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function handleUpload(
    e: ChangeEvent<HTMLInputElement>,
    slot: "avatar" | "cover" | "gallery",
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    // Client-side checks are UX-only — real enforcement is the Storage
    // bucket's file_size_limit/allowed_mime_types plus our own Zod
    // validation server-side (PRD §11: UI limits are cosmetic).
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Images must be 5MB or smaller.");
      return;
    }

    setUploading(slot);

    const ext = file.name.split(".").pop();
    const storagePath = `${vendorId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("vendor-images")
      .upload(storagePath, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(null);
      return;
    }

    const res = await fetch(`/api/vendors/${vendorId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath, slot }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        (typeof body?.error === "string" ? body.error : null) ??
          "Registering the upload failed. Try again.",
      );
      setUploading(null);
      return;
    }

    setUploading(null);
    router.refresh();
  }

  async function handleDelete(imageId: string) {
    setError(null);
    const res = await fetch(`/api/vendors/${vendorId}/images/${imageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        (typeof body?.error === "string" ? body.error : null) ??
          "Delete failed. Try again.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Images</h2>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-col gap-6">
        <div>
          <p className="text-sm font-medium">Avatar</p>
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="mt-2 h-16 w-16 rounded-full object-cover"
            />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading === "avatar"}
            onChange={(e) => handleUpload(e, "avatar")}
            className="mt-2 text-sm"
          />
        </div>

        <div>
          <p className="text-sm font-medium">Cover</p>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="mt-2 h-24 w-full rounded object-cover"
            />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading === "cover"}
            onChange={(e) => handleUpload(e, "cover")}
            className="mt-2 text-sm"
          />
        </div>

        <div>
          <p className="text-sm font-medium">
            Gallery ({images.length}/{MAX_GALLERY_IMAGES})
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {images.map((image) => {
              const { data } = supabase.storage
                .from("vendor-images")
                .getPublicUrl(image.storage_path);
              return (
                <div key={image.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.publicUrl}
                    alt={image.caption ?? ""}
                    className="aspect-square rounded object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleDelete(image.id)}
                    className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          {images.length < MAX_GALLERY_IMAGES && (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading === "gallery"}
              onChange={(e) => handleUpload(e, "gallery")}
              className="mt-2 text-sm"
            />
          )}
        </div>
      </div>
    </section>
  );
}
