"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="font-display text-3xl">Log in to PopSpot</h1>

      <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded border border-twine bg-paper px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded bg-stamp px-3 py-2 font-medium text-paper hover:bg-stamp/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {status === "sending" ? "Sending…" : "Send magic link"}
        </button>
        {status === "sent" && (
          <p className="text-sm text-marker">
            Check your email for a login link.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-stamp">
            Something went wrong. Try again.
          </p>
        )}
      </form>

      <div className="flex items-center gap-2 text-sm text-twine">
        <span className="h-px flex-1 bg-twine/40" />
        or
        <span className="h-px flex-1 bg-twine/40" />
      </div>

      <button
        onClick={handleGoogleSignIn}
        className="rounded border border-twine px-3 py-2 text-ink hover:border-stamp hover:text-stamp focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
      >
        Continue with Google
      </button>
    </div>
  );
}
