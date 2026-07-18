import { z } from "zod";

export const MAX_REPEAT_WEEKS = 12;

export const createEventSchema = z
  .object({
    venue_name: z.string().min(1).max(200),
    address_text: z.string().min(1).max(300),
    title: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    repeatWeeks: z.number().int().min(1).max(MAX_REPEAT_WEEKS).optional(),
  })
  .refine((data) => new Date(data.end_time) > new Date(data.start_time), {
    message: "end_time must be after start_time",
    path: ["end_time"],
  });

export const updateEventSchema = z
  .object({
    venue_name: z.string().min(1).max(200).optional(),
    address_text: z.string().min(1).max(300).optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    status: z.enum(["scheduled", "cancelled", "completed"]).optional(),
  })
  .refine(
    (data) =>
      !(data.start_time && data.end_time) ||
      new Date(data.end_time) > new Date(data.start_time),
    { message: "end_time must be after start_time", path: ["end_time"] },
  );

export const bulkCancelSchema = z.object({
  venue_name: z.string().min(1).max(200),
  address_text: z.string().min(1).max(300),
});
