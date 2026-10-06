import { useCallback } from "react";

import type {
  EvaluatedStep,
  EvaluatedErrorRegion,
  FieldId,
  FormValues,
  ValidationIssue,
} from "../core";
import type { SaveStatus, SubmitStatus } from "./context";
import { useFormContext } from "./context";

export interface FormErrorIssue extends ValidationIssue {
  key: string;
}

export interface FormErrors<TValues extends FormValues> {
  hasErrors: boolean;
  issues: FormErrorIssue[];
  region: EvaluatedErrorRegion<TValues>;
  title?: string;
}

export interface FieldA11y {
  controlProps: {
    "aria-describedby"?: string;
    "aria-invalid"?: true;
    id: string;
  };
  errorProps: {
    id: string;
  };
  errorId: string;
  inputId: string;
  isInvalid: boolean;
  issue?: ValidationIssue;
}

export interface FormProgress<TValues extends FormValues> {
  currentStep: EvaluatedStep<TValues>;
  currentStepNumber: number;
  isComplete: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  label: string;
  percent: number;
  totalSteps: number;
  valueText: string;
  visibleSteps: EvaluatedStep<TValues>[];
}

export type ArrayFieldId<TValues extends FormValues> = {
  [TKey in FieldId<TValues>]: TValues[TKey] extends unknown[] ? TKey : never;
}[FieldId<TValues>];

export type ArrayFieldItem<TValue> = TValue extends (infer TItem)[]
  ? TItem
  : never;

export function useConversationForm<TValues extends FormValues>() {
  return useFormContext<TValues>();
}

export function useCurrentStep<TValues extends FormValues>() {
  const { currentStep, fields } = useFormContext<TValues>();
  return { fields, step: currentStep };
}

export function useFieldState<
  TValues extends FormValues,
  TKey extends FieldId<TValues>,
>(fieldId: TKey) {
  const { fields, issues, values } = useFormContext<TValues>();
  const field = fields.find((item) => item.id === fieldId);
  if (!field) {
    throw new Error(`Field "${fieldId}" is not visible in the current step.`);
  }
  return {
    error: issues.find((issue) => issue.field === fieldId)?.message,
    field,
    value: values[fieldId],
  };
}

export function useArrayField<
  TValues extends FormValues,
  TKey extends ArrayFieldId<TValues>,
>(fieldId: TKey) {
  type Item = ArrayFieldItem<TValues[TKey]>;
  const { setValue, values } = useFormContext<TValues>();
  const items = values[fieldId];
  if (!Array.isArray(items)) {
    throw new TypeError(`Field "${fieldId}" is not an array field.`);
  }
  const setItems = useCallback(
    (nextItems: Item[]) => {
      setValue(fieldId, nextItems as TValues[TKey]);
    },
    [fieldId, setValue]
  );
  const append = useCallback(
    (item: Item) => {
      setItems([...items, item]);
    },
    [items, setItems]
  );
  const insert = useCallback(
    (index: number, item: Item) => {
      setItems([...items.slice(0, index), item, ...items.slice(index)]);
    },
    [items, setItems]
  );
  const update = useCallback(
    (index: number, item: Item) => {
      setItems(
        items.map((current, currentIndex) =>
          currentIndex === index ? item : current
        )
      );
    },
    [items, setItems]
  );
  const remove = useCallback(
    (index: number) => {
      setItems(items.filter((_, currentIndex) => currentIndex !== index));
    },
    [items, setItems]
  );
  const move = useCallback(
    (fromIndex: number, toIndex: number) => {
      const item = items[fromIndex];
      if (item === undefined || fromIndex === toIndex) {
        return;
      }
      const withoutItem = items.filter(
        (_, currentIndex) => currentIndex !== fromIndex
      );
      setItems([
        ...withoutItem.slice(0, toIndex),
        item,
        ...withoutItem.slice(toIndex),
      ]);
    },
    [items, setItems]
  );
  return {
    append,
    insert,
    items,
    move,
    remove,
    setItems,
    update,
  };
}

export function useFieldA11y<
  TValues extends FormValues,
  TKey extends FieldId<TValues>,
>(fieldId: TKey): FieldA11y {
  const { form, issues } = useFormContext<TValues>();
  const issue = issues.find((item) => item.field === fieldId);
  const inputId = createFieldDomId(form.id, fieldId);
  const errorId = `${inputId}-error`;
  return {
    controlProps: {
      id: inputId,
      "aria-describedby": issue ? errorId : undefined,
      "aria-invalid": issue ? true : undefined,
    },
    errorId,
    errorProps: {
      id: errorId,
    },
    inputId,
    isInvalid: Boolean(issue),
    issue,
  };
}

export function useFormNavigation<TValues extends FormValues>() {
  const { back, canBack, currentStep, next, submit, submitStatus } =
    useFormContext<TValues>();
  return { back, canBack, currentStep, next, submit, submitStatus };
}

export function useFormSerialization<TValues extends FormValues>() {
  const { serialize } = useFormContext<TValues>();
  return serialize;
}

export function useFormErrors<TValues extends FormValues>(
  regionId = "default"
): FormErrors<TValues> {
  const { currentStep, form, issues, values } = useFormContext<TValues>();
  const region = form.evaluateErrorRegion(regionId, values);
  const visibleFields = new Set(
    [...form.fields.keys()].filter(
      (fieldId) => form.evaluateField(fieldId, values).visible
    )
  );
  const filteredIssues = issues.filter((issue) => {
    if (region.scope === "all" || region.scope === "submit") {
      return true;
    }
    if (region.scope === "currentStep") {
      return issue.stepId === currentStep.id || !issue.field;
    }
    return !issue.field || visibleFields.has(issue.field as FieldId<TValues>);
  });
  const regionIssues = filteredIssues.map((issue, index) => ({
    ...issue,
    key: `${region.id}:${issue.field ?? "form"}:${issue.stepId ?? "none"}:${index}`,
  }));
  return {
    hasErrors: regionIssues.length > 0,
    issues: regionIssues,
    region,
    title: region.titleText,
  };
}

export function useFormStatus<TValues extends FormValues>(): {
  isSaved: boolean;
  isSaving: boolean;
  isSubmitError: boolean;
  isSubmitting: boolean;
  saveStatus: SaveStatus;
  submitStatus: SubmitStatus;
} {
  const { saveStatus, submitStatus } = useFormContext<TValues>();
  return {
    isSaved: saveStatus === "saved",
    isSaving: saveStatus === "saving",
    isSubmitError: submitStatus === "error",
    isSubmitting: submitStatus === "submitting",
    saveStatus,
    submitStatus,
  };
}

export function useFormProgress<
  TValues extends FormValues,
>(): FormProgress<TValues> {
  const { currentStep, form, values } = useFormContext<TValues>();
  const visibleSteps = form.getVisibleSteps({ values });
  const currentIndex = visibleSteps.findIndex(
    (step) => step.id === currentStep.id
  );
  const currentStepNumber = currentIndex === -1 ? 0 : currentIndex + 1;
  const totalSteps = visibleSteps.length;
  const percent =
    totalSteps === 0 ? 0 : Math.round((currentStepNumber / totalSteps) * 100);
  const label =
    totalSteps === 0
      ? "Step 0 of 0"
      : `Step ${currentStepNumber} of ${totalSteps}`;
  return {
    currentStep,
    currentStepNumber,
    isComplete: currentStepNumber === totalSteps,
    isFirstStep: currentStepNumber <= 1,
    isLastStep: currentStepNumber === totalSteps,
    label,
    percent,
    totalSteps,
    valueText: `${label}: ${currentStep.titleText}`,
    visibleSteps,
  };
}

function createFieldDomId(formId: string, fieldId: string) {
  return `form-${formId}-${fieldId}`.replaceAll(/[^A-Za-z0-9_-]/g, "-");
}
