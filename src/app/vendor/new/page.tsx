import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold">Become a vendor</h1>
      <NewVendorForm />
    </main>
  );
}
