import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RatingForm } from "./rating-form";

// PRD F5's literal acceptance criterion: "My Plans splits upcoming vs
// past." The rating prompt (PRD §6) is shown once per VENDOR, not once
// per event — rating.sql's PK is (user_id, vendor_id), so a user with
// several past visits to the same vendor can only ever have one rating
// for them. Attached to their most recent qualifying past visit, not
// every one, to avoid a cluttered duplicate-prompt list.
export default async function MyPlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/me/plans");
  }

  const { data: rsvps } = await supabase
    .from("rsvp")
    .select("event:event_id(*, vendor:vendor_id(*))")
    .eq("user_id", user.id);

  const { data: ratedRows } = await supabase
    .from("rating")
    .select("vendor_id")
    .eq("user_id", user.id);
  const ratedVendorIds = new Set((ratedRows ?? []).map((r) => r.vendor_id));

  const now = new Date();
  const withEvent = (rsvps ?? []).filter((r) => r.event && r.event.vendor);
  const upcoming = withEvent
    .filter((r) => new Date(r.event!.end_time) >= now)
    .sort((a, b) => new Date(a.event!.start_time).getTime() - new Date(b.event!.start_time).getTime());
  const past = withEvent
    .filter((r) => new Date(r.event!.end_time) < now)
    .sort((a, b) => new Date(b.event!.start_time).getTime() - new Date(a.event!.start_time).getTime());

  // Most recent qualifying (non-cancelled) past visit per vendor, for
  // vendors not yet rated — same "status != 'cancelled'" exclusion as
  // rating's own RLS gate.
  const promptVendorIdByEventId = new Map<string, string>();
  const seenVendorForPrompt = new Set<string>();
  for (const r of past) {
    const vendorId = r.event!.vendor!.id;
    if (
      r.event!.status !== "cancelled" &&
      !ratedVendorIds.has(vendorId) &&
      !seenVendorForPrompt.has(vendorId)
    ) {
      seenVendorForPrompt.add(vendorId);
      promptVendorIdByEventId.set(r.event!.id, vendorId);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-xl font-semibold">My Plans</h1>

      <h2 className="mt-8 text-lg font-semibold">Upcoming</h2>
      {upcoming.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {upcoming.map((r) => (
            <li key={r.event!.id} className="rounded border p-3">
              <div
                className={
                  r.event!.status === "cancelled"
                    ? "font-medium text-gray-400 line-through"
                    : "font-medium"
                }
              >
                {r.event!.title ?? r.event!.vendor!.name}
              </div>
              <div className="text-sm text-gray-500">
                {r.event!.venue_name} · {new Date(r.event!.start_time).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">No upcoming plans yet.</p>
      )}

      <h2 className="mt-10 text-lg font-semibold">Past</h2>
      {past.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {past.map((r) => (
            <li key={r.event!.id} className="rounded border p-3">
              <div
                className={
                  r.event!.status === "cancelled"
                    ? "font-medium text-gray-400 line-through"
                    : "font-medium"
                }
              >
                {r.event!.title ?? r.event!.vendor!.name}
              </div>
              <div className="text-sm text-gray-500">
                {r.event!.venue_name} · {new Date(r.event!.start_time).toLocaleString()}
              </div>
              {promptVendorIdByEventId.has(r.event!.id) && (
                <RatingForm
                  vendorId={r.event!.vendor!.id}
                  vendorName={r.event!.vendor!.name}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          You haven&apos;t attended any pop-ups yet.
        </p>
      )}
    </main>
  );
}
