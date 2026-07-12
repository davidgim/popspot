import { createClient } from "@/lib/supabase/server";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Discover pop-ups near you</h1>
      <p className="mt-2 text-gray-500">
        Phase 1 skeleton — search, map, and event listings land in Phase 3.
      </p>

      {user ? (
        <div className="mt-6 flex items-center gap-3 text-sm">
          <span>Signed in as {user.email}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="underline">
              Log out
            </button>
          </form>
        </div>
      ) : (
        <a href="/login" className="mt-6 inline-block text-sm underline">
          Log in
        </a>
      )}
    </main>
  );
}
