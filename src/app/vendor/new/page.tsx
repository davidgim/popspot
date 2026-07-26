import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { NewVendorForm } from "./new-vendor-form";

export default async function NewVendorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/vendor/new");
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-2xl">Become a vendor</h1>
        <NewVendorForm />
      </main>
    </>
  );
}
