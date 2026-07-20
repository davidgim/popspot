import { z } from "zod";

export const locationSearchSchema = z.object({
  query: z.string().min(1).max(200),
});
