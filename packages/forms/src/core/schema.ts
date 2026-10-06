import type { StandardSchemaV1 } from "@standard-schema/spec";

import type {
  SerializedAnswer,
  SerializedForm,
  SerializedMessage,
} from "./types";

/** Provider-neutral validators for the SDK's transport envelope. */
export const serializedFormAnswerInput = envelopeSchema(
  isAnswer,
  "Expected a serialized answer."
);
export const serializedFormMessageInput = envelopeSchema(
  isMessage,
  "Expected a serialized message."
);
export const serializedFormInput = envelopeSchema(
  isForm,
  "Expected a serialized form."
);
export type SerializedFormInput = SerializedForm;

function envelopeSchema<T>(
  isValid: (value: unknown) => value is T,
  message: string
): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "crisp-forms",
      validate: (value) =>
        isValid(value) ? { value } : { issues: [{ message }] },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isAnswer(value: unknown): value is SerializedAnswer {
  return (
    isRecord(value) &&
    isNonEmpty(value.field) &&
    isNonEmpty(value.stepId) &&
    isOptionalString(value.label) &&
    Object.hasOwn(value, "value")
  );
}

function isMessage(value: unknown): value is SerializedMessage {
  return (
    isRecord(value) &&
    typeof value.content === "string" &&
    (value.role === "assistant" ||
      value.role === "system" ||
      value.role === "user") &&
    isOptionalString(value.stepId) &&
    (value.metadata === undefined || isRecord(value.metadata))
  );
}

function isForm(value: unknown): value is SerializedForm {
  return (
    isRecord(value) &&
    isNonEmpty(value.formId) &&
    isOptionalString(value.currentStepId) &&
    Array.isArray(value.answers) &&
    value.answers.every(isAnswer) &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage)
  );
}
