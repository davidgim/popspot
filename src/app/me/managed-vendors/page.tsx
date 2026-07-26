import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";

// Vendors the user owns/manages — distinct from /me/vendors (followed
// vendors, PRD §5 F5). RLS's vendor_select_authenticated already returns
// a user's own vendor rows regardless of is_active ("...so they can
// review/reactivate"), so this is a plain ownership query, no new policy
// needed.
export default async function ManagedVendorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/me/managed-vendors");
  }

  const { data: vendors } = await supabase
    .from("vendor")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-display text-2xl">Manage Vendors</h1>

        {vendors && vendors.length > 0 ? (
          <ul className="mt-6 flex flex-col gap-4">
            {vendors.map((vendor) => (
              <li
                key={vendor.id}
                className="ticket-stub flex items-center gap-3 rounded-r border-y border-r border-twine p-3"
              >
                {vendor.avatar_url && (
                  <Image
                    src={vendor.avatar_url}
                    alt={vendor.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                )}
                <div className="flex-1">
                  <a
                    href={`/v/${vendor.slug}/edit`}
                    className="font-medium text-stamp underline underline-offset-2"
                  >
                    {vendor.name}
                  </a>
                  {!vendor.is_active && (
                    <span className="ml-2 text-xs text-twine">(inactive)</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-twine">
            You don&apos;t own any vendors yet.{" "}
            <a href="/vendor/new" className="text-stamp underline underline-offset-2">
              Become a vendor
            </a>
          </p>
        )}
      </main>
    </>
  );
}
