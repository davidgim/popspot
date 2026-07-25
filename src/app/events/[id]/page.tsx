import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ToggleButton } from "@/components/toggle-button";

// Same static-image decision as /v/[slug] — vendor's own uploaded photo,
// not a dynamically-rendered card. Same vendor.is_active exclusion as
// the page itself, for consistency: a deactivated vendor's event
// shouldn't get a real-looking share preview pointing at a page that
// 404s.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("event")
    .select("title, description, venue_name, start_time, vendor(name, is_active, cover_image_url, avatar_url)")
    .eq("id", id)
    .maybeSingle();

  if (!event || !event.vendor || !event.vendor.is_active) {
    return { title: "Event not found" };
  }

  const title = event.title ?? event.vendor.name;
  const description =
    event.description ??
    `${event.vendor.name} at ${event.venue_name}, ${new Date(event.start_time).toLocaleDateString()}.`;
  const image = event.vendor.cover_image_url ?? event.vendor.avatar_url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : [],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

// Server-rendered, shareable event detail page — same shape as
// /v/[slug]. Explicit vendor.is_active check (not relied on implicitly
// via RLS-embed interaction) applies the same exclusion search_events
// already does: a link to a deactivated vendor's event would otherwise
// point at a vendor page that 404s (vendor_select_public requires
// is_active for anon), a broken result either way.
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("event")
    .select("*, vendor(*)")
    .eq("id", id)
    .maybeSingle();

  if (!event || !event.vendor || !event.vendor.is_active) {
    notFound();
  }

  const vendor = event.vendor;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existingRsvp } = user
    ? await supabase
        .from("rsvp")
        .select("event_id")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <a href={`/v/${vendor.slug}`} className="text-sm underline">
        ← {vendor.name}
      </a>

      <h1
        className={`mt-4 text-2xl font-semibold ${
          event.status === "cancelled" ? "text-gray-400 line-through" : ""
        }`}
      >
        {event.title ?? vendor.name}
      </h1>

      {event.status === "cancelled" && (
        <p className="mt-1 text-sm text-red-600">This event was cancelled.</p>
      )}

      <div className="mt-2 flex items-center gap-3">
        {vendor.avatar_url && (
          <Image
            src={vendor.avatar_url}
            alt={vendor.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        )}
        <p className="text-sm text-gray-500">
          {vendor.avg_rating != null
            ? `${vendor.avg_rating.toFixed(1)} ★ (${vendor.rating_count})`
            : "No ratings yet"}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-1 text-sm">
        <div className="font-medium">{event.venue_name}</div>
        <div className="text-gray-500">{event.address_text}</div>
        <div className="text-gray-500">
          {new Date(event.start_time).toLocaleString()} –{" "}
          {new Date(event.end_time).toLocaleString()}
        </div>
      </div>

      {event.description && <p className="mt-4 text-sm">{event.description}</p>}

      <div className="mt-6">
        <ToggleButton
          endpoint={`/api/events/${event.id}/rsvp`}
          initialActive={!!existingRsvp}
          activeLabel="Going"
          inactiveLabel="I'm going"
          isLoggedIn={!!user}
          loginRedirect={`/events/${event.id}`}
        />
      </div>
    </main>
  );
}
