"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";

type Vendor = Pick<
  Database["public"]["Tables"]["vendor"]["Row"],
  | "id"
  | "slug"
  | "name"
  | "bio"
  | "cuisine_tags"
  | "instagram_url"
  | "tiktok_url"
  | "website_url"
  | "is_active"
>;

export function VendorDetailsForm({ vendor }: { vendor: Vendor }) {
  const router = useRouter();
  const [slug, setSlug] = useState(vendor.slug);
  const [name, setName] = useState(vendor.name);
  const [bio, setBio] = useState(vendor.bio ?? "");
  const [cuisineTags, setCuisineTags] = useState(
    vendor.cuisine_tags?.join(", ") ?? "",
  );
  const [instagramUrl, setInstagramUrl] = useState(vendor.instagram_url ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(vendor.tiktok_url ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(vendor.website_url ?? "");
  const [isActive, setIsActive] = useState(vendor.is_active);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    const res = await fetch(`/api/vendors/${vendor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        name,
        bio: bio || undefined,
        cuisine_tags: cuisineTags
          ? cuisineTags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
        instagram_url: instagramUrl || undefined,
        tiktok_url: tiktokUrl || undefined,
        website_url: websiteUrl || undefined,
        is_active: isActive,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      if (updated.slug !== vendor.slug) {
        router.push(`/v/${updated.slug}/edit`);
        return;
      }
      setStatus("saved");
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(
      body?.error?.formErrors?.[0] ??
        (typeof body?.error === "string" ? body.error : null) ??
        "Something went wrong. Try again.",
    );
    setStatus("idle");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <label className="text-sm text-gray-500">
        Slug (popspot.com/v/{slug || "…"})
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Vendor name"
        className="rounded border px-3 py-2"
      />
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Bio"
        rows={3}
        className="rounded border px-3 py-2"
      />
      <input
        type="text"
        value={cuisineTags}
        onChange={(e) => setCuisineTags(e.target.value)}
        placeholder="Cuisine tags, comma-separated"
        className="rounded border px-3 py-2"
      />
      <input
        type="url"
        value={instagramUrl}
        onChange={(e) => setInstagramUrl(e.target.value)}
        placeholder="Instagram URL"
        className="rounded border px-3 py-2"
      />
      <input
        type="url"
        value={tiktokUrl}
        onChange={(e) => setTiktokUrl(e.target.value)}
        placeholder="TikTok URL"
        className="rounded border px-3 py-2"
      />
      <input
        type="url"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        placeholder="Website URL"
        className="rounded border px-3 py-2"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active (visible to the public)
      </label>
      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : "Save changes"}
      </button>
      {status === "saved" && <p className="text-sm text-green-600">Saved.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
