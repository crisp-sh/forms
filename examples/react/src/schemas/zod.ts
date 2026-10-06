import z from "zod";

import type { InquirySchemas } from "../form";

// Zod 4 implements Standard Schema directly; no SDK-specific adapter.
export const zodSchemas = {
  name: z.string().trim().min(1, "Enter your name to continue."),
  audience: z.enum(["individual", "team"]),
  team: z.string().trim().min(1, "Enter your team name to continue."),
} satisfies InquirySchemas;
