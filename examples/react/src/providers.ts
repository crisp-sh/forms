import { createInquiry } from "./form";
import { effectSchemas } from "./schemas/effect";
import { typeboxSchemas } from "./schemas/typebox";
import { zodSchemas } from "./schemas/zod";

export const providers = {
  zod: { label: "Zod", form: createInquiry(zodSchemas) },
  effect: { label: "Effect", form: createInquiry(effectSchemas) },
  typebox: { label: "TypeBox", form: createInquiry(typeboxSchemas) },
};
export type Provider = keyof typeof providers;
