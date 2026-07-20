"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";

type Event = Pick<
  Database["public"]["Tables"]["event"]["Row"],
  | "id"
  | "title"
  | "venue_name"
  | "address_text"
  | "start_time"
  | "end_time"
  | "status"
  | "description"
>;

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function EventForm({
  vendorId,
  event,
  onDone,
}: {
  vendorId: string;
  event?: Event;
  onDone: () => void;
}) {
  const router = useRouter();
  const [venueName, setVenueName] = useState(event?.venue_name ?? "");
  const [addressText, setAddressText] = useState(event?.address_text ?? "");
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startTime, setStartTime] = useState(
    event ? toLocalInputValue(event.start_time) : "",
  );
  const [endTime, setEndTime] = useState(
    event ? toLocalInputValue(event.end_time) : "",
  );
  const [repeatWeeks, setRepeatWeeks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = event
      ? `/api/vendors/${vendorId}/events/${event.id}`
      : `/api/vendors/${vendorId}/events`;
    const method = event ? "PATCH" : "POST";

    const body: Record<string, unknown> = {
      venue_name: venueName,
      address_text: addressText,
      title: title || undefined,
      description: description || undefined,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
    };
    if (!event && repeatWeeks) {
      body.repeatWeeks = Number(repeatWeeks);
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSubmitting(false);
      router.refresh();
      onDone();
      return;
    }

    const resBody = await res.json().catch(() => null);
    setError(
      resBody?.error?.formErrors?.[0] ??
        (typeof resBody?.error === "string" ? resBody.error : null) ??
        "Something went wrong. Try again.",
    );
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-2 rounded border p-3"
    >
      <input
        type="text"
        required
        value={venueName}
        onChange={(e) => setVenueName(e.target.value)}
        placeholder="Venue name"
        className="rounded border px-3 py-2"
      />
      <input
        type="text"
        required
        value={addressText}
        onChange={(e) => setAddressText(e.target.value)}
        placeholder="Address"
        className="rounded border px-3 py-2"
      />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional, defaults to vendor name)"
        className="rounded border px-3 py-2"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="rounded border px-3 py-2"
      />
      <label className="text-sm text-gray-500">
        Start
        <input
          type="datetime-local"
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="text-sm text-gray-500">
        End
        <input
          type="datetime-local"
          required
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      {!event && (
        <label className="text-sm text-gray-500">
          Repeat weekly for N weeks (optional, max 12)
          <input
            type="number"
            min={1}
            max={12}
            value={repeatWeeks}
            onChange={(e) => setRepeatWeeks(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : event ? "Save" : "Create event"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded border px-3 py-2"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function EventManager({
  vendorId,
  events,
}: {
  vendorId: string;
  events: Event[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(eventId: string) {
    setError(null);
    const res = await fetch(`/api/vendors/${vendorId}/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) {
      setError("Failed to cancel event.");
      return;
    }
    router.refresh();
  }

  async function handleBulkCancel(event: Event) {
    setError(null);
    const res = await fetch(`/api/vendors/${vendorId}/events/bulk-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venue_name: event.venue_name,
        address_text: event.address_text,
      }),
    });
    if (!res.ok) {
      setError("Failed to bulk-cancel.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Events</h2>
        <button
          type="button"
          onClick={() => setShowCreate((s) => !s)}
          className="text-sm underline"
        >
          {showCreate ? "Close" : "+ New event"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showCreate && (
        <EventForm vendorId={vendorId} onDone={() => setShowCreate(false)} />
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {events.map((event) =>
          editingId === event.id ? (
            <li key={event.id}>
              <EventForm
                vendorId={vendorId}
                event={event}
                onDone={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={event.id} className="rounded border p-3">
              <div
                className={
                  event.status === "cancelled"
                    ? "font-medium text-gray-400 line-through"
                    : "font-medium"
                }
              >
                {event.title ?? "Untitled"} — {event.venue_name}
              </div>
              <div className="text-sm text-gray-500">
                {new Date(event.start_time).toLocaleString()} · {event.status}
              </div>
              {event.status === "scheduled" && (
                <div className="mt-2 flex gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => setEditingId(event.id)}
                    className="underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(event.id)}
                    className="underline"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkCancel(event)}
                    className="underline"
                  >
                    Cancel this + all future here
                  </button>
                </div>
              )}
            </li>
          ),
        )}
        {events.length === 0 && (
          <p className="text-sm text-gray-500">No events yet.</p>
        )}
      </ul>
    </section>
  );
}
