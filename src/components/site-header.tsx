import type { User } from "@supabase/supabase-js";

export function SiteHeader({ user }: { user: User | null }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-y-2 bg-slate px-4 py-3 text-paper">
      <a href="/discover" className="font-display text-xl tracking-wide">
        PopSpot
      </a>
      {user ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="hidden font-mono text-xs text-twine sm:inline">
            {user.email}
          </span>
          <a href="/me/vendors" className="underline decoration-twine underline-offset-2 hover:text-marker">
            My Vendors
          </a>
          <a href="/me/plans" className="underline decoration-twine underline-offset-2 hover:text-marker">
            My Plans
          </a>
          <a href="/vendor/new" className="underline decoration-twine underline-offset-2 hover:text-marker">
            Become a vendor
          </a>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="underline decoration-twine underline-offset-2 hover:text-marker"
            >
              Log out
            </button>
          </form>
        </div>
      ) : (
        <a href="/login" className="text-sm font-medium text-marker underline underline-offset-2">
          Log in
        </a>
      )}
    </header>
  );
}
