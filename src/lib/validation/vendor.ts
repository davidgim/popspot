import { z } from "zod";

// avatar_url/cover_image_url are deliberately absent — those are only
// ever set as a side effect of an upload going through Storage (see
// upload-vendor-image), never accepted as a free-text URL here.
export const becomeVendorSchema = z.object({
  name: z.string().min(1).max(100),
  bio: z.string().max(1000).optional(),
  cuisine_tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  instagram_url: z.string().url().optional(),
  tiktok_url: z.string().url().optional(),
  website_url: z.string().url().optional(),
});

export const updateVendorSchema = becomeVendorSchema.partial().extend({
  slug: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
});
