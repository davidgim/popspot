import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <SiteHeader user={user} />
      <LoginForm />
    </>
  );
}
