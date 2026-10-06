import z from "zod";

export const serializedFormAnswerInput = z.object({
  field: z.string().min(1),
  label: z.string().optional(),
  stepId: z.string().min(1),
  value: z.unknown(),
});

export const serializedFormMessageInput = z.object({
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  role: z.enum(["assistant", "system", "user"]),
  stepId: z.string().optional(),
});

export const serializedFormInput = z.object({
  answers: z.array(serializedFormAnswerInput),
  currentStepId: z.string().optional(),
  formId: z.string().min(1),
  messages: z.array(serializedFormMessageInput),
});

export type SerializedFormInput = z.infer<typeof serializedFormInput>;
