"use client";

import { useState } from "react";

// Shared by Follow, Like, and RSVP (three near-identical optimistic
// toggles, all POST-to-activate / DELETE-to-deactivate against the same
// URL) — crosses CLAUDE.md's three-times duplication threshold, and
// unlike most cases we already know all three instances up front rather
// than guessing at a future need.
//
// Genuinely optimistic (PRD F5's literal acceptance criterion): the
// visible state flips synchronously, before the fetch() call resolves.
// Rolls back on failure. `pending` disables the button while a request
// is in flight, preventing rapid double-clicks from racing each other,
// without undercutting the instant-flip feel — the state has already
// changed by the time the button becomes disabled.
export function ToggleButton({
  endpoint,
  initialActive,
  activeLabel,
  inactiveLabel,
  isLoggedIn,
  loginRedirect,
}: {
  endpoint: string;
  initialActive: boolean;
  activeLabel: string;
  inactiveLabel: string;
  isLoggedIn: boolean;
  loginRedirect: string;
}) {
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(false);

  if (!isLoggedIn) {
    return (
      <a href={`/login?next=${loginRedirect}`} className="text-sm underline">
        Log in to {inactiveLabel.toLowerCase()}
      </a>
    );
  }

  async function handleClick() {
    const next = !active;
    setActive(next);
    setPending(true);
    const res = await fetch(endpoint, { method: next ? "POST" : "DELETE" });
    setPending(false);
    if (!res.ok) {
      setActive(!next);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}
