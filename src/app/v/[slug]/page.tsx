import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ToggleButton } from "@/components/toggle-button";
import { SiteHeader } from "@/components/site-header";

// Static OG image (decision, Phase 5 plan): reuses the vendor's own
// uploaded photo directly, not a dynamically-rendered branded card.
// Vendors with no photo get no og:image at all — a plain link preview,
// acceptable since not every vendor will have uploaded photos yet.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: vendor } = await supabase
    .from("vendor")
    .select("name, bio, cover_image_url, avatar_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!vendor) {
    return { title: "Vendor not found" };
  }

  const description = vendor.bio ?? `Find ${vendor.name} on PopSpot.`;
  const image = vendor.cover_image_url ?? vendor.avatar_url;

  return {
    title: vendor.name,
    description,
    openGraph: {
      title: vendor.name,
      description,
      images: image ? [image] : [],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: vendor.name,
      description,
      images: image ? [image] : [],
    },
  };
}

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
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-16">
      {vendor.cover_image_url && (
        <div className="relative mb-6 h-48 w-full">
          <Image
            src={vendor.cover_image_url}
            alt=""
            fill
            className="rounded object-cover"
          />
        </div>
      )}

      <div className="ticket-stub rounded-r border-y border-r border-twine p-4">
        <div className="flex items-center gap-4">
          {vendor.avatar_url && (
            <Image
              src={vendor.avatar_url}
              alt={vendor.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
            />
          )}
          <div>
            <h1 className="font-display text-3xl">{vendor.name}</h1>
            <p className="text-sm text-twine">
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
      </div>

      {vendor.bio && <p className="mt-4">{vendor.bio}</p>}

      {vendor.cuisine_tags && vendor.cuisine_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {vendor.cuisine_tags.map((tag: string) => (
            <span key={tag} className="rounded-full border border-twine px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-3 text-sm">
        {vendor.instagram_url && (
          <a href={vendor.instagram_url} className="text-stamp underline underline-offset-2">
            Instagram
          </a>
        )}
        {vendor.tiktok_url && (
          <a href={vendor.tiktok_url} className="text-stamp underline underline-offset-2">
            TikTok
          </a>
        )}
        {vendor.website_url && (
          <a href={vendor.website_url} className="text-stamp underline underline-offset-2">
            Website
          </a>
        )}
      </div>

      {images && images.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div key={image.id} className="relative aspect-square">
              <Image
                src={
                  supabase.storage
                    .from("vendor-images")
                    .getPublicUrl(image.storage_path).data.publicUrl
                }
                alt={image.caption ?? ""}
                fill
                className="rounded object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">Upcoming events</h2>
      {events && events.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className={event.status === "cancelled" ? "text-ink/40 line-through" : undefined}
            >
              <div className="font-medium">{event.title ?? vendor.name}</div>
              <div className="font-mono text-sm text-twine">
                {event.venue_name} ·{" "}
                {new Date(event.start_time).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-twine">No upcoming events yet.</p>
      )}
      </main>
    </>
  );
}
