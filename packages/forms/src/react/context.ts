import { createContext, useContext } from "react";

import type {
  Form,
  EvaluatedField,
  EvaluatedStep,
  FormValues,
  SerializedForm,
  ValidationIssue,
} from "../core";
import type { ActiveShortcut } from "./keybinds";
import type { FormPersistenceOptions } from "./persistence";

export type SaveStatus = "error" | "idle" | "saved" | "saving";
export type SubmitStatus = "error" | "idle" | "submitted" | "submitting";

export interface FormTransport<TValues extends FormValues> {
  save?: (payload: SerializedForm, values: TValues) => Promise<void>;
  submit?: (payload: SerializedForm, values: TValues) => Promise<void>;
}

export interface ConversationContextValue<TValues extends FormValues> {
  back: () => void;
  canBack: boolean;
  currentStep: EvaluatedStep<TValues>;
  editSubmission: () => void;
  fields: EvaluatedField<TValues>[];
  form: Form<TValues>;
  issues: ValidationIssue[];
  isPending: boolean;
  next: () => Promise<void>;
  saveStatus: SaveStatus;
  serialize: () => SerializedForm;
  selectChoice: <TKey extends keyof TValues & string>(
    fieldId: TKey,
    value: TValues[TKey],
    shortcutKey?: string
  ) => void;
  setValue: <TKey extends keyof TValues & string>(
    fieldId: TKey,
    value: TValues[TKey]
  ) => void;
  shortcut?: ActiveShortcut;
  submit: () => Promise<void>;
  submitStatus: SubmitStatus;
  values: TValues;
}

export const ConversationContext =
  createContext<ConversationContextValue<FormValues> | null>(null);

export interface FormProviderProps<TValues extends FormValues> {
  autosaveDelayMs?: number;
  children: React.ReactNode;
  enableKeybinds?: boolean;
  form: Form<TValues>;
  hydrationFallback?: React.ReactNode;
  initialStepId?: string;
  onComplete?: () => void;
  persistence?: FormPersistenceOptions;
  shortcutDelayMs?: number;
  submissionKey?: string;
  transport?: FormTransport<TValues>;
}

/** Internal storage boundary shared by the TanStack and Effect Atom providers. */
export interface FormValueStore<TValues extends FormValues> {
  values: TValues;
  setFieldValue: <TKey extends keyof TValues & string>(
    key: TKey,
    value: TValues[TKey]
  ) => void;
}

export function useFormContext<TValues extends FormValues>() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error("useFormContext must be used inside FormProvider.");
  }
  return context as unknown as ConversationContextValue<TValues>;
}
