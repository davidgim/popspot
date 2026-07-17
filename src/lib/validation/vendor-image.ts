import { z } from "zod";

export const uploadVendorImageSchema = z.object({
  storagePath: z.string().min(1),
  slot: z.enum(["avatar", "cover", "gallery"]).default("gallery"),
  caption: z.string().max(200).optional(),
});

export const MAX_GALLERY_IMAGES = 10;
