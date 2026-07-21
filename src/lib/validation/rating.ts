import { z } from "zod";

export const setRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
});
