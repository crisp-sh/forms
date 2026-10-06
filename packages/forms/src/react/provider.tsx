import { useForm, useStore } from "@tanstack/react-form";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Form } from "../core";
import type {
  EvaluatedField,
  EvaluatedStep,
  FormValues,
  SerializedForm,
  ValidationIssue,
} from "../core";
import { createKeybindHandler } from "./keybinds";
import type { ActiveShortcut } from "./keybinds";
import { clearFormDraft, readFormDraft, writeFormDraft } from "./persistence";
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

const ConversationContext =
  createContext<ConversationContextValue<FormValues> | null>(null);

export function FormProvider<TValues extends FormValues>({
  autosaveDelayMs = 800,
  children,
  enableKeybinds = true,
  form,
  hydrationFallback = null,
  initialStepId,
  onComplete,
  persistence,
  shortcutDelayMs = 650,
  submissionKey,
  transport,
}: {
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
}) {
  const persistenceKey = persistence?.key;
  const shouldClearPersistedDraft = persistence?.clearOnSubmit !== false;
  const [hasLoadedPersistedDraft, setHasLoadedPersistedDraft] = useState(
    () => !persistenceKey
  );
  const initialValues = form.defaults;
  const visibleInitialSteps = form.getVisibleSteps({ values: initialValues });
  const firstStepId = initialStepId ?? visibleInitialSteps[0]?.id;
  if (!firstStepId) {
    throw new Error(`Form "${form.id}" has no visible initial step.`);
  }

  const tanstackForm = useForm({
    defaultValues: initialValues,
  });
  const values = useStore(tanstackForm.store, (state) => state.values);
  const [currentStepId, setCurrentStepId] = useState(firstStepId);
  const [history, setHistory] = useState<string[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [shortcut, setShortcut] = useState<ActiveShortcut | undefined>();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const shortcutTimeout = useRef<number | null>(null);
  const saveSnapshot = useRef("");
  const clearPersistedDraft = useCallback(() => {
    if (!persistenceKey || !shouldClearPersistedDraft) {
      return;
    }
    clearFormDraft(persistenceKey);
  }, [persistenceKey, shouldClearPersistedDraft]);
  const currentStep = form.evaluateStep(currentStepId, values);
  const fields = form.getFieldsForStep(currentStep.id, values);
  const serialized = useMemo(
    () => form.serialize({ currentStepId: currentStep.id, values }),
    [currentStep.id, form, values]
  );
  const setValue = useCallback(
    <TKey extends keyof TValues & string>(
      fieldId: TKey,
      value: TValues[TKey]
    ) => {
      tanstackForm.setFieldValue(fieldId, value as never);
      setIssues((current) =>
        current.filter((issue) => issue.field !== fieldId)
      );
    },
    [tanstackForm]
  );

  useEffect(() => {
    if (!persistenceKey) {
      setHasLoadedPersistedDraft(true);
      return;
    }

    const draft = readFormDraft(persistenceKey, form.defaults);
    if (!draft) {
      setHasLoadedPersistedDraft(true);
      return;
    }

    for (const [fieldId, value] of Object.entries(draft.values)) {
      tanstackForm.setFieldValue(
        fieldId as keyof TValues & string,
        value as never
      );
    }

    const visibleDraftSteps = form.getVisibleSteps({ values: draft.values });
    const visibleDraftStepIds = new Set(
      visibleDraftSteps.map((step) => step.id)
    );
    setCurrentStepId(
      draft.currentStepId && visibleDraftStepIds.has(draft.currentStepId)
        ? draft.currentStepId
        : (visibleDraftSteps[0]?.id ?? firstStepId)
    );
    setHistory(
      draft.history.filter((stepId) => visibleDraftStepIds.has(stepId))
    );
    setSubmitStatus(draft.submitStatus ?? "idle");
    setHasLoadedPersistedDraft(true);
  }, [firstStepId, form, persistenceKey, tanstackForm]);

  const saveValues = useCallback(
    async (nextValues: TValues) => {
      if (!hasLoadedPersistedDraft || !transport?.save) {
        return;
      }
      const nextSerialized = form.serialize({
        currentStepId: currentStep.id,
        values: nextValues,
      });
      const snapshot = JSON.stringify(nextSerialized);
      if (snapshot === saveSnapshot.current || submitStatus === "submitted") {
        return;
      }
      setSaveStatus("saving");
      try {
        await transport.save(nextSerialized, nextValues);
        saveSnapshot.current = snapshot;
        setSaveStatus("saved");
      } catch {
        setIssues((current) => [
          ...current.filter((issue) => issue.source !== "transport"),
          {
            message: "We could not save this yet.",
            source: "transport",
            stepId: currentStep.id,
          },
        ]);
        setSaveStatus("error");
      }
    },
    [currentStep.id, form, hasLoadedPersistedDraft, submitStatus, transport]
  );

  const save = useCallback(async () => {
    await saveValues(values);
  }, [saveValues, values]);

  const editSubmission = useCallback(() => {
    setIssues([]);
    setSaveStatus("idle");
    setSubmitStatus("idle");
  }, []);

  const submitValues = useCallback(
    async (nextValues: TValues) => {
      const result = form.validateSubmit({ values: nextValues });
      setIssues(result.issues);
      if (!result.ok) {
        return;
      }
      const nextSerialized = form.serialize({
        currentStepId: currentStep.id,
        values: nextValues,
      });
      if (!transport?.submit) {
        setSubmitStatus("submitted");
        clearPersistedDraft();
        onComplete?.();
        return;
      }
      setSubmitStatus("submitting");
      try {
        await transport.submit(nextSerialized, nextValues);
        setSubmitStatus("submitted");
        clearPersistedDraft();
        onComplete?.();
      } catch {
        setIssues((current) => [
          ...current.filter((issue) => issue.source !== "transport"),
          {
            message: "We could not send this yet.",
            source: "transport",
            stepId: currentStep.id,
          },
        ]);
        setSubmitStatus("error");
      }
    },
    [clearPersistedDraft, currentStep.id, form, onComplete, transport]
  );

  const submit = useCallback(async () => {
    await submitValues(values);
  }, [submitValues, values]);

  const nextValues = useCallback(
    async (nextFormValues: TValues) => {
      const result = form.validateStep({
        stepId: currentStep.id,
        values: nextFormValues,
      });
      setIssues(result.issues);
      if (!result.ok) {
        return;
      }
      const nextStep = form.getNextStep({
        currentStepId: currentStep.id,
        values: nextFormValues,
      });
      if (!nextStep) {
        await submitValues(nextFormValues);
        return;
      }
      await saveValues(nextFormValues);
      setHistory((current) => [...current, currentStep.id]);
      setCurrentStepId(nextStep.id);
    },
    [currentStep.id, form, saveValues, submitValues]
  );

  const clearShortcutTimeout = useCallback(() => {
    if (shortcutTimeout.current === null) {
      return;
    }
    window.clearTimeout(shortcutTimeout.current);
    shortcutTimeout.current = null;
  }, []);

  const next = useCallback(async () => {
    clearShortcutTimeout();
    setShortcut(undefined);
    await nextValues(values);
  }, [clearShortcutTimeout, nextValues, values]);

  const scheduleShortcutNext = useCallback(
    (nextShortcut: ActiveShortcut, nextFormValues: TValues) => {
      clearShortcutTimeout();
      setShortcut(nextShortcut);
      shortcutTimeout.current = window.setTimeout(() => {
        shortcutTimeout.current = null;
        setShortcut(undefined);
        void nextValues(nextFormValues);
      }, shortcutDelayMs);
    },
    [clearShortcutTimeout, nextValues, shortcutDelayMs]
  );
  const selectChoice = useCallback(
    <TKey extends keyof TValues & string>(
      fieldId: TKey,
      value: TValues[TKey],
      shortcutKey?: string
    ) => {
      const choiceField = fields.length === 1 ? fields[0] : undefined;
      const shouldAutoAdvance =
        choiceField?.kind === "choice" && String(choiceField.id) === fieldId;
      setValue(fieldId, value);
      if (!shouldAutoAdvance) {
        return;
      }
      scheduleShortcutNext(
        {
          fieldId,
          key: shortcutKey ?? "",
          value,
        },
        {
          ...values,
          [fieldId]: value,
        } as TValues
      );
    },
    [fields, scheduleShortcutNext, setValue, values]
  );

  const back = useCallback(() => {
    clearShortcutTimeout();
    setShortcut(undefined);
    const previousStep = form.getPreviousStep({
      currentStepId: currentStep.id,
      history,
      values,
    });
    if (!previousStep) {
      return;
    }
    setIssues([]);
    setHistory((current) => current.slice(0, -1));
    setCurrentStepId(previousStep.id);
  }, [clearShortcutTimeout, currentStep.id, form, history, values]);

  useEffect(() => {
    if (currentStep.visible) {
      return;
    }
    const nextStep = form.getNextStep({
      currentStepId: currentStep.id,
      values,
    });
    if (nextStep) {
      setCurrentStepId(nextStep.id);
    }
  }, [currentStep.id, currentStep.visible, form, values]);

  useEffect(() => {
    for (const field of form.fields.values()) {
      if (
        field.clearWhenHidden &&
        !form.evaluateField(field.id, values).visible &&
        !Object.is(values[field.id], field.defaultValue)
      ) {
        setValue(field.id, field.defaultValue);
      }
    }
  }, [form, setValue, values]);

  useEffect(() => {
    if (!hasLoadedPersistedDraft || !persistenceKey) {
      return;
    }
    writeFormDraft(persistenceKey, {
      currentStepId: currentStep.id,
      history,
      submitStatus: submitStatus === "submitted" ? "submitted" : undefined,
      submissionKey,
      values,
    });
  }, [
    currentStep.id,
    hasLoadedPersistedDraft,
    history,
    persistenceKey,
    submissionKey,
    submitStatus,
    values,
  ]);

  useEffect(() => {
    if (!hasLoadedPersistedDraft) {
      return;
    }

    const timeout = window.setTimeout(() => void save(), autosaveDelayMs);
    return () => window.clearTimeout(timeout);
  }, [autosaveDelayMs, hasLoadedPersistedDraft, save]);

  useEffect(() => clearShortcutTimeout, [clearShortcutTimeout]);

  useEffect(() => {
    clearShortcutTimeout();
    setShortcut(undefined);
  }, [clearShortcutTimeout, currentStep.id]);

  useEffect(() => {
    if (
      !hasLoadedPersistedDraft ||
      !enableKeybinds ||
      submitStatus === "submitting"
    ) {
      return;
    }
    const onKeyDown = createKeybindHandler({
      back,
      fields,
      next,
      selectChoice,
    });
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    back,
    enableKeybinds,
    fields,
    hasLoadedPersistedDraft,
    next,
    selectChoice,
    submitStatus,
  ]);

  const value = useMemo(
    () =>
      ({
        back,
        canBack: Boolean(
          form.getPreviousStep({
            currentStepId: currentStep.id,
            history,
            values,
          })
        ),
        currentStep,
        editSubmission,
        fields,
        form,
        issues,
        next,
        saveStatus,
        serialize: () => serialized,
        selectChoice,
        setValue,
        shortcut,
        submit,
        submitStatus,
        values,
      }) satisfies ConversationContextValue<TValues>,
    [
      back,
      currentStep,
      editSubmission,
      fields,
      form,
      history,
      issues,
      next,
      saveStatus,
      serialized,
      selectChoice,
      setValue,
      shortcut,
      submit,
      submitStatus,
      values,
    ]
  );

  if (!hasLoadedPersistedDraft) {
    return <>{hydrationFallback}</>;
  }

  return (
    <ConversationContext.Provider
      value={value as unknown as ConversationContextValue<FormValues>}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useFormContext<TValues extends FormValues>() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error("useFormContext must be used inside FormProvider.");
  }
  return context as unknown as ConversationContextValue<TValues>;
}
