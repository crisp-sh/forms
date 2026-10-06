import type z from "zod";

import type {
  Dynamic,
  EvaluatedField,
  FieldId,
  FieldOption,
  FormScope,
  FormValues,
  RegisteredField,
  StepWhenResult,
  ValidationIssue,
  ValidationSuggestion,
} from "./types";

const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export function deriveOptions<TValues extends FormValues>(
  field: RegisteredField<TValues>
) {
  const schema = field.schema as z.ZodType & {
    options?: TValues[FieldId<TValues>][];
  };
  if (!schema.options) {
    if (field.kind === "choice") {
      throw new Error(
        `Choice field "${field.id}" needs options or enum schema.`
      );
    }
    return;
  }
  return schema.options.map((value) => ({
    label: String(value),
    value,
  }));
}

export function formatFieldValue<TValues extends FormValues>(
  field: EvaluatedField<TValues>,
  value: unknown
) {
  const option = field.optionsList?.find((item) => item.value === value);
  if (option) {
    return option.label;
  }
  return String(value);
}

export function normalizeStepWhen(result: StepWhenResult) {
  if (typeof result === "string") {
    return { nextStepId: result, visible: true };
  }
  if (typeof result === "boolean") {
    return { visible: result };
  }
  return {
    nextStepId: result.next,
    visible: result.show,
  };
}

export function requireValidFieldId(fieldId: string) {
  if (!FIELD_ID_PATTERN.test(fieldId)) {
    throw new Error(`Invalid field id "${fieldId}".`);
  }
}

export function resolveDynamic<TValues extends FormValues, TValue>(
  value: Dynamic<TValues, TValue>,
  scope: FormScope<TValues>
) {
  if (typeof value === "function") {
    return (value as (form: FormScope<TValues>) => TValue)(scope);
  }
  return value;
}

export function validateOptions<TValues extends FormValues>(
  field: RegisteredField<TValues>,
  options: FieldOption<TValues[FieldId<TValues>]>[]
) {
  for (const option of options) {
    if (!field.schema.safeParse(option.value).success) {
      throw new Error(`Option for field "${field.id}" does not match schema.`);
    }
  }
  return options;
}

export function validationResult(issues: ValidationIssue[]) {
  return {
    issues,
    ok: issues.length === 0,
  };
}

export function validateFieldValue<TValues extends FormValues>(
  field: EvaluatedField<TValues>,
  values: TValues
) {
  const result = field.schema.safeParse(values[field.id]);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => ({
    field: field.id,
    message: issue.message,
    source: "field" as const,
    stepId: field.stepId,
  }));
}

export function validateEvaluatedField<TValues extends FormValues>(
  field: EvaluatedField<TValues>,
  values: TValues
) {
  const schemaIssues = validateFieldValue(field, values);
  if (schemaIssues.length > 0 || !field.optionValidation) {
    return schemaIssues;
  }
  if (matchesOption(field, values[field.id])) {
    return [];
  }
  return [
    {
      field: field.id,
      message: field.optionValidation.message,
      source: "field" as const,
      stepId: field.stepId,
      suggestion: field.optionValidation.suggest
        ? findClosestOptionSuggestion(field, values[field.id])
        : undefined,
    },
  ];
}

export function findClosestOptionSuggestion<TValues extends FormValues>(
  field: EvaluatedField<TValues>,
  value: unknown
): ValidationSuggestion | undefined {
  const query = normalizeSearchValue(value);
  if (!query || !field.optionsList?.length) {
    return;
  }
  const [suggestion] = field.optionsList
    .map((option) => ({
      label: option.label,
      score: Math.max(
        searchSimilarity(query, normalizeSearchValue(option.label)),
        searchSimilarity(query, normalizeSearchValue(option.value))
      ),
      value: option.value,
    }))
    .toSorted((first, second) => second.score - first.score);
  const minScore =
    typeof field.optionValidation?.suggest === "object"
      ? field.optionValidation.suggest.minScore
      : undefined;
  if (!suggestion || suggestion.score < (minScore ?? 0.45)) {
    return;
  }
  return {
    label: suggestion.label,
    value: suggestion.value,
  };
}

export function matchesOption<TValues extends FormValues>(
  field: EvaluatedField<TValues>,
  value: unknown
) {
  return field.optionsList?.some(
    (option) =>
      Object.is(option.value, value) ||
      normalizeSearchValue(option.value) === normalizeSearchValue(value) ||
      normalizeSearchValue(option.label) === normalizeSearchValue(value)
  );
}

function normalizeSearchValue(value: unknown) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchSimilarity(source: string, target: string) {
  if (!source || !target) {
    return 0;
  }
  if (source === target) {
    return 1;
  }
  if (target.includes(source) || source.includes(target)) {
    return (
      Math.min(source.length, target.length) /
      Math.max(source.length, target.length)
    );
  }
  return (
    1 -
    levenshteinDistance(source, target) / Math.max(source.length, target.length)
  );
}

function levenshteinDistance(source: string, target: string) {
  const distances = Array.from(
    { length: target.length + 1 },
    (_, index) => index
  );
  for (const [sourceIndex, sourceCharacter] of [...source].entries()) {
    let previous = sourceIndex;
    distances[0] = sourceIndex + 1;
    for (const [targetIndex, targetCharacter] of [...target].entries()) {
      const current = distances[targetIndex + 1] ?? 0;
      distances[targetIndex + 1] =
        sourceCharacter === targetCharacter
          ? previous
          : Math.min(previous, distances[targetIndex] ?? 0, current) + 1;
      previous = current;
    }
  }
  return distances[target.length] ?? 0;
}
