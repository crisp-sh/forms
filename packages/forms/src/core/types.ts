import type { StandardSchemaV1 } from "@standard-schema/spec";

export type FormValues = Record<string, unknown>;
export type FieldId<TValues extends FormValues> = Extract<
  keyof TValues,
  string
>;
export type StepKind = "intro" | "review" | "statement" | "fields";
export type MessageRole = "assistant" | "system" | "user";
export type ErrorRegionScope = "all" | "currentStep" | "submit" | "visible";
export type ValidationIssueSource = "field" | "form" | "transport";

export interface SerializedAnswer {
  field: string;
  label?: string;
  stepId: string;
  value: unknown;
}

export interface SerializedMessage {
  content: string;
  metadata?: Record<string, unknown>;
  role: MessageRole;
  stepId?: string;
}

export interface SerializedForm {
  answers: SerializedAnswer[];
  currentStepId?: string;
  formId: string;
  messages: SerializedMessage[];
}

export interface FormScope<TValues extends FormValues> {
  answer: <TKey extends FieldId<TValues>>(key: TKey) => SerializedAnswer | null;
  value: <TKey extends FieldId<TValues>>(key: TKey) => TValues[TKey];
  values: () => TValues;
  visible: <TKey extends FieldId<TValues>>(key: TKey) => boolean;
}

export type Dynamic<TValues extends FormValues, TValue> =
  | TValue
  | ((form: FormScope<TValues>) => TValue);

export type FieldWhen<TValues extends FormValues> =
  | boolean
  | ((form: FormScope<TValues>) => boolean);

export type StepWhenResult =
  | boolean
  | string
  | {
      next?: string;
      show: boolean;
    };

export type StepWhen<TValues extends FormValues> =
  | StepWhenResult
  | ((form: FormScope<TValues>) => StepWhenResult);

export interface FieldOption<TValue> {
  label: string;
  value: TValue;
}

export interface FieldOptionValidation {
  message: string;
  suggest?: boolean | { minScore?: number };
}

export interface FieldDefinition<
  TValues extends FormValues,
  TKey extends FieldId<TValues>,
> {
  clearWhenHidden?: boolean;
  defaultValue: TValues[TKey];
  kind: string;
  label: Dynamic<TValues, string>;
  optionValidation?: FieldOptionValidation;
  options?: Dynamic<TValues, FieldOption<TValues[TKey]>[]>;
  placeholder?: Dynamic<TValues, string>;
  /** Validates the editable input; schema transformations do not mutate form state. */
  schema: StandardSchemaV1<TValues[TKey], unknown>;
  serialize?: (
    value: TValues[TKey],
    form: FormScope<TValues>
  ) => SerializedAnswer;
  when?: FieldWhen<TValues>;
}

export interface RegisteredField<TValues extends FormValues> {
  clearWhenHidden: boolean;
  defaultValue: TValues[FieldId<TValues>];
  id: FieldId<TValues>;
  kind: string;
  label: Dynamic<TValues, string>;
  optionValidation?: FieldOptionValidation;
  options?: Dynamic<TValues, FieldOption<TValues[FieldId<TValues>]>[]>;
  placeholder?: Dynamic<TValues, string>;
  schema: StandardSchemaV1<TValues[FieldId<TValues>], unknown>;
  serialize?: (
    value: TValues[FieldId<TValues>],
    form: FormScope<TValues>
  ) => SerializedAnswer;
  when?: FieldWhen<TValues>;
}

export interface StepDefinition<TValues extends FormValues> {
  description?: Dynamic<TValues, string>;
  fields?: FieldId<TValues>[];
  kind?: StepKind;
  title: Dynamic<TValues, string>;
  when?: StepWhen<TValues>;
}

export interface RegisteredStep<
  TValues extends FormValues,
> extends StepDefinition<TValues> {
  id: string;
  kind: StepKind;
}

export interface EvaluatedStep<
  TValues extends FormValues,
> extends RegisteredStep<TValues> {
  descriptionText?: string;
  nextStepId?: string;
  titleText: string;
  visible: boolean;
}

export interface EvaluatedField<
  TValues extends FormValues,
> extends RegisteredField<TValues> {
  labelText: string;
  optionsList?: FieldOption<TValues[FieldId<TValues>]>[];
  placeholderText?: string;
  stepId?: string;
  visible: boolean;
}

export interface ValidationIssue {
  /** Field id followed by the provider's normalized nested issue path. */
  path?: readonly PropertyKey[];
  field?: string;
  source?: ValidationIssueSource;
  stepId?: string;
  message: string;
  suggestion?: ValidationSuggestion;
}

export interface ValidationSuggestion {
  label: string;
  value: unknown;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  ok: boolean;
}

export interface FormRefinement<TValues extends FormValues> {
  field?: FieldId<TValues>;
  includeHidden?: boolean;
  message: string;
  refine: (form: FormScope<TValues>) => boolean;
  when?: FieldWhen<TValues>;
}

export interface ErrorRegionDefinition<TValues extends FormValues> {
  empty?: "hidden" | "reserved";
  scope?: ErrorRegionScope;
  title?: Dynamic<TValues, string>;
}

export interface RegisteredErrorRegion<
  TValues extends FormValues,
> extends ErrorRegionDefinition<TValues> {
  id: string;
  scope: ErrorRegionScope;
}

export interface EvaluatedErrorRegion<
  TValues extends FormValues,
> extends RegisteredErrorRegion<TValues> {
  titleText?: string;
}
