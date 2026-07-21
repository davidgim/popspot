"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// PUT /api/vendors/[id]/rating finds the caller's own qualifying RSVP
// server-side — this form only ever needs to submit `stars`, never an
// event_id.
export function RatingForm({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (stars < 1) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/vendors/${vendorId}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't submit your rating. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 rounded border border-dashed p-3">
      <p className="text-sm font-medium">How was {vendorName}?</p>
      <div className="mt-2 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`text-xl ${n <= stars ? "text-black" : "text-gray-300"}`}
          >
            ★
          </button>
        ))}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={stars < 1 || submitting}
          className="ml-2 rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
