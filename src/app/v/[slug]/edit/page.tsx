import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { VendorDetailsForm } from "./vendor-details-form";
import { ImageManager } from "./image-manager";
import { EventManager } from "./event-manager";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/v/${slug}/edit`);
  }

  const { data: vendor } = await supabase
    .from("vendor")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  // Ownership check here is UX only, not the security boundary — RLS's
  // vendor SELECT policy deliberately allows any authenticated user to
  // read active vendors (public-read design), so it can't distinguish
  // "owner" from "any logged-in visitor" the way this page needs to. The
  // actual write-protection is still update-vendor's RLS policy,
  // unaffected by this check.
  if (!vendor || vendor.owner_user_id !== user.id) {
    notFound();
  }

  const { data: images } = await supabase
    .from("vendor_image")
    .select("*")
    .eq("vendor_id", vendor.id)
    .order("sort_order");

  // Unlike the public /v/[slug] page, this fetch has no start_time filter
  // — the owner needs to see past and cancelled events too, not just
  // upcoming ones, to actually manage them.
  const { data: events } = await supabase
    .from("event")
    .select("*")
    .eq("vendor_id", vendor.id)
    .order("start_time", { ascending: false });

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-display text-2xl">Edit {vendor.name}</h1>
        <VendorDetailsForm vendor={vendor} />
        <ImageManager
          vendorId={vendor.id}
          avatarUrl={vendor.avatar_url}
          coverUrl={vendor.cover_image_url}
          images={images ?? []}
        />
        <EventManager vendorId={vendor.id} events={events ?? []} />
      </main>
    </>
  );
}
