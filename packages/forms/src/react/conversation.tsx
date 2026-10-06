import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FormValues, ValidationIssue } from "../core";
import { ConversationContext } from "./context";
import type { SaveStatus, SubmitStatus } from "./context";
import type {
  ConversationContextValue,
  FormProviderProps,
  FormValueStore,
} from "./context";
import { createKeybindHandler } from "./keybinds";
import type { ActiveShortcut } from "./keybinds";
import { useFormOperation } from "./operation";
import { clearFormDraft, readFormDraft, writeFormDraft } from "./persistence";

export function ConversationProvider<TValues extends FormValues>({
  store,
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
}: FormProviderProps<TValues> & { store: FormValueStore<TValues> }) {
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

  const { values, setFieldValue } = store;
  const [currentStepId, setCurrentStepId] = useState(firstStepId);
  const [history, setHistory] = useState<string[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [shortcut, setShortcut] = useState<ActiveShortcut | undefined>();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const shortcutTimeout = useRef<number | null>(null);
  const saveSnapshot = useRef("");
  const onValidationError = useCallback(() => {
    setIssues([
      {
        message: "We could not validate this yet. Please try again.",
        source: "form",
      },
    ]);
  }, []);
  const { invalidate, isPending, run } = useFormOperation(onValidationError);
  useEffect(invalidate, [invalidate, values, currentStepId]);
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
      invalidate();
      setFieldValue(fieldId, value);
      setIssues((current) =>
        current.filter((issue) => issue.field !== fieldId)
      );
    },
    [invalidate, setFieldValue]
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
      setFieldValue(
        fieldId as keyof TValues & string,
        value as TValues[keyof TValues & string]
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
  }, [firstStepId, form, persistenceKey, setFieldValue]);

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
    async (nextValues: TValues, isCurrent: () => boolean) => {
      if (submitStatus === "submitted") {
        return;
      }
      const result = await form.validateSubmit({ values: nextValues });
      if (!isCurrent()) {
        return;
      }
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
        // Navigation can cancel validation, but cannot undo an already-sent request.
        // Record its outcome so a successful submission cannot be sent again.
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
    [
      clearPersistedDraft,
      currentStep.id,
      form,
      onComplete,
      submitStatus,
      transport,
    ]
  );

  const submit = useCallback(async () => {
    await run((isCurrent) => submitValues(values, isCurrent));
  }, [run, submitValues, values]);

  const nextValues = useCallback(
    async (nextFormValues: TValues, isCurrent: () => boolean) => {
      const result = await form.validateStep({
        stepId: currentStep.id,
        values: nextFormValues,
      });
      if (!isCurrent()) {
        return;
      }
      setIssues(result.issues);
      if (!result.ok) {
        return;
      }
      const nextStep = form.getNextStep({
        currentStepId: currentStep.id,
        values: nextFormValues,
      });
      if (!nextStep) {
        await submitValues(nextFormValues, isCurrent);
        return;
      }
      await saveValues(nextFormValues);
      if (!isCurrent()) {
        return;
      }
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
    await run((isCurrent) => nextValues(values, isCurrent));
  }, [clearShortcutTimeout, nextValues, run, values]);

  const scheduleShortcutNext = useCallback(
    (nextShortcut: ActiveShortcut, nextFormValues: TValues) => {
      clearShortcutTimeout();
      setShortcut(nextShortcut);
      shortcutTimeout.current = window.setTimeout(() => {
        shortcutTimeout.current = null;
        setShortcut(undefined);
        void run((isCurrent) => nextValues(nextFormValues, isCurrent));
      }, shortcutDelayMs);
    },
    [clearShortcutTimeout, nextValues, run, shortcutDelayMs]
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
    invalidate();
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
  }, [clearShortcutTimeout, currentStep.id, form, history, invalidate, values]);

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
      isPending ||
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
    isPending,
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
        isPending,
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
      isPending,
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
