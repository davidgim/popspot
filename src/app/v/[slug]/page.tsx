import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToggleButton } from "@/components/toggle-button";

// Plain <img> tags, not next/image — using next/image against Supabase
// Storage URLs needs remotePatterns configured in next.config.ts, which
// isn't set up yet. Deliberate Phase 2 simplification; revisit in the
// Phase 5 polish pass.
export default async function VendorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendor")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: images }, { data: events }, { data: existingFollow }, { data: existingLike }] =
    await Promise.all([
      supabase
        .from("vendor_image")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("sort_order"),
      supabase
        .from("event")
        .select("*")
        .eq("vendor_id", vendor.id)
        .gte("start_time", new Date().toISOString())
        .order("start_time"),
      user
        ? supabase
            .from("follow")
            .select("vendor_id")
            .eq("vendor_id", vendor.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase
            .from("vendor_like")
            .select("vendor_id")
            .eq("vendor_id", vendor.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      {vendor.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vendor.cover_image_url}
          alt=""
          className="mb-6 h-48 w-full rounded object-cover"
        />
      )}

      <div className="flex items-center gap-4">
        {vendor.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vendor.avatar_url}
            alt={vendor.name}
            className="h-16 w-16 rounded-full object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{vendor.name}</h1>
          <p className="text-sm text-gray-500">
            {vendor.avg_rating != null
              ? `${vendor.avg_rating.toFixed(1)} ★ (${vendor.rating_count})`
              : "No ratings yet"}
            {" · "}
            {vendor.like_count} likes
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <ToggleButton
          endpoint={`/api/vendors/${vendor.id}/follow`}
          initialActive={!!existingFollow}
          activeLabel="Following"
          inactiveLabel="Follow"
          isLoggedIn={!!user}
          loginRedirect={`/v/${vendor.slug}`}
        />
        <ToggleButton
          endpoint={`/api/vendors/${vendor.id}/like`}
          initialActive={!!existingLike}
          activeLabel="Liked"
          inactiveLabel="Like"
          isLoggedIn={!!user}
          loginRedirect={`/v/${vendor.slug}`}
        />
      </div>

      {vendor.bio && <p className="mt-4">{vendor.bio}</p>}

      {vendor.cuisine_tags && vendor.cuisine_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {vendor.cuisine_tags.map((tag: string) => (
            <span key={tag} className="rounded-full border px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-3 text-sm">
        {vendor.instagram_url && (
          <a href={vendor.instagram_url} className="underline">
            Instagram
          </a>
        )}
        {vendor.tiktok_url && (
          <a href={vendor.tiktok_url} className="underline">
            TikTok
          </a>
        )}
        {vendor.website_url && (
          <a href={vendor.website_url} className="underline">
            Website
          </a>
        )}
      </div>

      {images && images.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-2">
          {images.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={image.id}
              src={
                supabase.storage
                  .from("vendor-images")
                  .getPublicUrl(image.storage_path).data.publicUrl
              }
              alt={image.caption ?? ""}
              className="aspect-square rounded object-cover"
            />
          ))}
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">Upcoming events</h2>
      {events && events.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className={
                event.status === "cancelled"
                  ? "text-gray-400 line-through"
                  : undefined
              }
            >
              <div className="font-medium">{event.title ?? vendor.name}</div>
              <div className="text-sm text-gray-500">
                {event.venue_name} ·{" "}
                {new Date(event.start_time).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-gray-500">No upcoming events yet.</p>
      )}
    </main>
  );
}
