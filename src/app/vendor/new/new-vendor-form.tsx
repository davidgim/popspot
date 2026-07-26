"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewVendorForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [cuisineTags, setCuisineTags] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        bio: bio || undefined,
        cuisine_tags: cuisineTags
          ? cuisineTags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
        instagram_url: instagramUrl || undefined,
        tiktok_url: tiktokUrl || undefined,
        website_url: websiteUrl || undefined,
      }),
    });

    if (res.ok) {
      const vendor = await res.json();
      router.push(`/v/${vendor.slug}/edit`);
      return;
    }

    const body = await res.json().catch(() => null);
    setError(
      body?.error?.formErrors?.[0] ??
        (typeof body?.error === "string" ? body.error : null) ??
        "Something went wrong. Try again.",
    );
    setSubmitting(false);
  }

  const inputClass =
    "rounded border border-twine bg-paper px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp";

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Vendor name"
        className={inputClass}
      />
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Bio (optional)"
        rows={3}
        className={inputClass}
      />
      <input
        type="text"
        value={cuisineTags}
        onChange={(e) => setCuisineTags(e.target.value)}
        placeholder="Cuisine tags, comma-separated (optional)"
        className={inputClass}
      />
      <input
        type="url"
        value={instagramUrl}
        onChange={(e) => setInstagramUrl(e.target.value)}
        placeholder="Instagram URL (optional)"
        className={inputClass}
      />
      <input
        type="url"
        value={tiktokUrl}
        onChange={(e) => setTiktokUrl(e.target.value)}
        placeholder="TikTok URL (optional)"
        className={inputClass}
      />
      <input
        type="url"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        placeholder="Website URL (optional)"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-stamp px-3 py-2 font-medium text-paper hover:bg-stamp/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {submitting ? "Creating…" : "Create vendor"}
      </button>
      {error && <p className="text-sm text-stamp">{error}</p>}
    </form>
  );
}
