// Pure sanitizer — lowercase, non-alphanumeric runs become a single
// hyphen, leading/trailing hyphens trimmed. Shared by create (auto-derive
// from name) and update (sanitize whatever the owner types directly).
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
