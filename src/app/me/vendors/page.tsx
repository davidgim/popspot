import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

// Followed vendors, per PRD §5 F5 / §8's route sketch literally: "Heart a
// vendor from any surface -> appears in 'My Vendors'." Not vendors the
// user owns/manages — that's a different, currently-missing feature
// (logged in TODO.md), out of this phase's scope.
export default async function MyVendorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/me/vendors");
  }

  const { data: follows } = await supabase
    .from("follow")
    .select("created_at, vendor:vendor_id(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-xl font-semibold">My Vendors</h1>

      {follows && follows.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-3">
          {follows.map(
            (f) =>
              f.vendor && (
                <li key={f.vendor.id} className="flex items-center gap-3 rounded border p-3">
                  {f.vendor.avatar_url && (
                    <Image
                      src={f.vendor.avatar_url}
                      alt={f.vendor.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <a href={`/v/${f.vendor.slug}`} className="font-medium underline">
                    {f.vendor.name}
                  </a>
                </li>
              ),
          )}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-gray-500">
          You&apos;re not following any vendors yet.{" "}
          <a href="/discover" className="underline">
            Discover pop-ups
          </a>
        </p>
      )}
    </main>
  );
}
