import type { StandardSchemaV1 } from "@standard-schema/spec";

import { objectSchema } from "./standard";
import type {
  ErrorRegionDefinition,
  EvaluatedErrorRegion,
  EvaluatedField,
  EvaluatedStep,
  FieldDefinition,
  FieldId,
  FormRefinement,
  FormScope,
  FormValues,
  RegisteredErrorRegion,
  RegisteredField,
  RegisteredStep,
  SerializedAnswer,
  SerializedForm,
  SerializedMessage,
  StepDefinition,
  ValidationResult,
} from "./types";
import {
  formatFieldValue,
  normalizeStepWhen,
  requireValidFieldId,
  resolveDynamic,
  validateEvaluatedField,
  validationResult,
} from "./utils";

export class Form<TValues extends FormValues> {
  readonly errorRegions = new Map<string, RegisteredErrorRegion<TValues>>();
  readonly fields = new Map<FieldId<TValues>, RegisteredField<TValues>>();
  readonly id: string;
  readonly refinements: FormRefinement<TValues>[] = [];
  readonly steps: RegisteredStep<TValues>[] = [];

  constructor(id: string) {
    this.id = id;
    this.errorRegions.set("default", {
      empty: "hidden",
      id: "default",
      scope: "currentStep",
    });
  }

  get defaults() {
    return Object.fromEntries(
      [...this.fields.values()].map((field) => [field.id, field.defaultValue])
    ) as TValues;
  }

  /** All registered fields, including hidden fields; returns provider-transformed output. */
  get schema(): StandardSchemaV1<TValues, Record<string, unknown>> {
    return objectSchema(
      Object.fromEntries(
        [...this.fields.values()].map((field) => [field.id, field.schema])
      )
    );
  }

  field<TKey extends FieldId<TValues>>(
    id: TKey,
    definition: FieldDefinition<TValues, TKey>
  ) {
    requireValidFieldId(id);
    if (this.fields.has(id)) {
      throw new Error(`Duplicate field id "${id}".`);
    }
    if (definition.kind === "choice" && !definition.options) {
      throw new Error(`Choice field "${id}" needs explicit options.`);
    }
    this.fields.set(id, {
      ...definition,
      clearWhenHidden: definition.clearWhenHidden ?? false,
      id,
    } as RegisteredField<TValues>);
    return this;
  }

  intro(id: string, definition: Omit<StepDefinition<TValues>, "fields">) {
    return this.addStep(id, { ...definition, kind: "intro" });
  }

  review(id: string, definition: Omit<StepDefinition<TValues>, "fields">) {
    return this.addStep(id, { ...definition, kind: "review" });
  }

  statement(id: string, definition: Omit<StepDefinition<TValues>, "fields">) {
    return this.addStep(id, { ...definition, kind: "statement" });
  }

  step(id: string, definition: StepDefinition<TValues>) {
    return this.addStep(id, {
      ...definition,
      kind: definition.kind ?? "fields",
    });
  }

  refine(
    refine: (form: FormScope<TValues>) => boolean,
    options: Omit<FormRefinement<TValues>, "refine">
  ) {
    if (options.field && !this.fields.has(options.field)) {
      throw new Error(
        `Refinement references unknown field "${options.field}".`
      );
    }
    this.refinements.push({ ...options, refine });
    return this;
  }

  errors(id: string, definition: ErrorRegionDefinition<TValues>) {
    this.errorRegions.set(id, {
      empty: definition.empty ?? "hidden",
      ...definition,
      id,
      scope: definition.scope ?? "currentStep",
    });
    return this;
  }

  createScope(values: TValues): FormScope<TValues> {
    return {
      answer: (key) =>
        this.serialize({ values }).answers.find(
          (answer) => answer.field === key
        ) ?? null,
      value: (key) => values[key],
      values: () => values,
      visible: (key) => this.isFieldVisible(key, values),
    };
  }

  evaluateField<TKey extends FieldId<TValues>>(
    fieldId: TKey,
    values: TValues,
    stepId?: string
  ) {
    const field = this.requireField(fieldId);
    const scope = this.createScope(values);
    const evaluated = {
      ...field,
      labelText: resolveDynamic(field.label, scope),
      optionsList: field.options
        ? resolveDynamic(field.options, scope)
        : undefined,
      placeholderText: field.placeholder
        ? resolveDynamic(field.placeholder, scope)
        : undefined,
      stepId,
      visible: this.isFieldVisible(fieldId, values),
    } satisfies EvaluatedField<TValues>;
    return evaluated;
  }

  evaluateStep(stepId: string, values: TValues) {
    const step = this.requireStep(stepId);
    const scope = this.createScope(values);
    const when = normalizeStepWhen(
      step.when ? resolveDynamic(step.when, scope) : true
    );
    const fields = step.fields ?? [];
    const hasVisibleFields =
      fields.length === 0 ||
      fields.some((fieldId) => this.isFieldVisible(fieldId, values));
    const visible = when.visible && hasVisibleFields;
    if (when.nextStepId) {
      this.requireStep(when.nextStepId);
    }
    return {
      ...step,
      descriptionText: step.description
        ? resolveDynamic(step.description, scope)
        : undefined,
      nextStepId: when.nextStepId,
      titleText: resolveDynamic(step.title, scope),
      visible,
    } satisfies EvaluatedStep<TValues>;
  }

  evaluateErrorRegion(id: string, values: TValues) {
    const region = this.errorRegions.get(id);
    if (!region) {
      throw new Error(`Unknown error region "${id}".`);
    }
    return {
      ...region,
      titleText: region.title
        ? resolveDynamic(region.title, this.createScope(values))
        : undefined,
    } satisfies EvaluatedErrorRegion<TValues>;
  }

  getVisibleSteps({ values }: { values: TValues }) {
    return this.steps
      .map((step) => this.evaluateStep(step.id, values))
      .filter((step) => step.visible);
  }

  getFieldsForStep(stepId: string, values: TValues) {
    return (this.requireStep(stepId).fields ?? [])
      .map((fieldId) => this.evaluateField(fieldId, values, stepId))
      .filter((field) => field.visible);
  }

  getNextStep({
    currentStepId,
    values,
  }: {
    currentStepId: string;
    values: TValues;
  }) {
    const current = this.evaluateStep(currentStepId, values);
    const visibleSteps = this.getVisibleSteps({ values });
    if (current.nextStepId) {
      const target = this.evaluateStep(current.nextStepId, values);
      if (!target.visible) {
        throw new Error(
          `Step "${currentStepId}" targets hidden step "${current.nextStepId}".`
        );
      }
      return target;
    }
    const currentIndex = this.getVisibleStepIndexAfter(
      currentStepId,
      visibleSteps
    );
    return visibleSteps[currentIndex + 1] ?? null;
  }

  getPreviousStep({
    currentStepId,
    history,
    values,
  }: {
    currentStepId: string;
    history: string[];
    values: TValues;
  }) {
    const visibleSteps = this.getVisibleSteps({ values });
    const historyTarget = history
      .toReversed()
      .map((stepId) => visibleSteps.find((step) => step.id === stepId))
      .find(Boolean);
    if (historyTarget) {
      return historyTarget;
    }
    const currentIndex = this.getVisibleStepIndexAfter(
      currentStepId,
      visibleSteps
    );
    return visibleSteps[currentIndex - 1] ?? null;
  }

  async validateStep({
    stepId,
    values,
  }: {
    stepId: string;
    values: TValues;
  }): Promise<ValidationResult> {
    const issues = await Promise.all(
      this.getFieldsForStep(stepId, values).map((field) =>
        validateEvaluatedField(field, values)
      )
    );
    return validationResult(issues.flat());
  }

  async validateSubmit({
    values,
  }: {
    values: TValues;
  }): Promise<ValidationResult> {
    const issues = await Promise.all(
      [...this.fields.keys()]
        .filter((fieldId) => this.isFieldVisible(fieldId, values))
        .map((fieldId) =>
          validateEvaluatedField(
            this.evaluateField(
              fieldId,
              values,
              this.getStepIdForField(fieldId)
            ),
            values
          )
        )
    );
    return validationResult([
      ...issues.flat(),
      ...this.validateRefinements(values),
    ]);
  }

  serialize({
    currentStepId,
    includeHidden = false,
    values,
  }: {
    currentStepId?: string;
    includeHidden?: boolean;
    values: TValues;
  }): SerializedForm {
    const answers = this.serializeAnswers({ includeHidden, values });
    return {
      answers,
      currentStepId,
      formId: this.id,
      messages: [
        ...answers.flatMap((answer) =>
          this.serializeAnswerMessages(answer, values)
        ),
        ...(currentStepId
          ? [
              {
                content: `Current step: ${currentStepId}`,
                metadata: { stepId: currentStepId },
                role: "system" as const,
                stepId: currentStepId,
              },
            ]
          : []),
      ],
    };
  }

  private addStep(id: string, definition: StepDefinition<TValues>) {
    if (this.steps.some((step) => step.id === id)) {
      throw new Error(`Duplicate step id "${id}".`);
    }
    const kind = definition.kind ?? "fields";
    const fields = definition.fields ?? [];
    if (fields.length === 0 && kind === "fields") {
      throw new Error(`Field step "${id}" must reference at least one field.`);
    }
    for (const fieldId of fields) {
      this.requireField(fieldId);
    }
    this.steps.push({ ...definition, fields, id, kind });
    return this;
  }

  private getVisibleStepIndexAfter(
    stepId: string,
    visibleSteps: EvaluatedStep<TValues>[]
  ) {
    const visibleIndex = visibleSteps.findIndex((step) => step.id === stepId);
    if (visibleIndex !== -1) {
      return visibleIndex;
    }
    const orderedIndex = this.steps.findIndex((step) => step.id === stepId);
    return (
      visibleSteps.findIndex(
        (step) =>
          this.steps.findIndex((orderedStep) => orderedStep.id === step.id) >
          orderedIndex
      ) - 1
    );
  }

  private getStepIdForField(fieldId: FieldId<TValues>) {
    return this.steps.find((step) => step.fields?.includes(fieldId))?.id;
  }

  private isFieldVisible<TKey extends FieldId<TValues>>(
    fieldId: TKey,
    values: TValues
  ) {
    const field = this.requireField(fieldId);
    if (!field.when) {
      return true;
    }
    return Boolean(resolveDynamic(field.when, this.createScope(values)));
  }

  private requireField<TKey extends FieldId<TValues>>(fieldId: TKey) {
    const field = this.fields.get(fieldId);
    if (!field) {
      throw new Error(`Unknown field "${fieldId}".`);
    }
    return field;
  }

  private requireStep(stepId: string) {
    const step = this.steps.find((item) => item.id === stepId);
    if (!step) {
      throw new Error(`Unknown step "${stepId}".`);
    }
    return step;
  }

  private serializeAnswerMessages(answer: SerializedAnswer, values: TValues) {
    const step = answer.stepId
      ? this.evaluateStep(answer.stepId, values)
      : null;
    const field = this.fields.has(answer.field as FieldId<TValues>)
      ? this.evaluateField(answer.field as FieldId<TValues>, values)
      : null;
    return [
      ...(step
        ? [
            {
              content: step.titleText,
              role: "assistant" as const,
              stepId: answer.stepId,
            },
          ]
        : []),
      {
        content: field
          ? formatFieldValue(field, answer.value)
          : String(answer.value),
        role: "user" as const,
        stepId: answer.stepId,
      },
    ] satisfies SerializedMessage[];
  }

  private serializeAnswers({
    includeHidden,
    values,
  }: {
    includeHidden: boolean;
    values: TValues;
  }) {
    return [...this.fields.keys()]
      .filter(
        (fieldId) => includeHidden || this.isFieldVisible(fieldId, values)
      )
      .map((fieldId) => this.serializeFieldAnswer(fieldId, values));
  }

  private serializeFieldAnswer<TKey extends FieldId<TValues>>(
    fieldId: TKey,
    values: TValues
  ) {
    const field = this.evaluateField(fieldId, values);
    const stepId = this.getStepIdForField(fieldId) ?? fieldId;
    if (field.serialize) {
      return {
        ...field.serialize(values[fieldId], this.createScope(values)),
        stepId,
      };
    }
    return {
      field: fieldId,
      label: field.labelText,
      stepId,
      value: values[fieldId],
    } satisfies SerializedAnswer;
  }

  private validateRefinements(values: TValues) {
    const scope = this.createScope(values);
    return this.refinements.flatMap((refinement) => {
      if (
        refinement.field &&
        !refinement.includeHidden &&
        !this.isFieldVisible(refinement.field, values)
      ) {
        return [];
      }
      if (refinement.when && !resolveDynamic(refinement.when, scope)) {
        return [];
      }
      if (refinement.refine(scope)) {
        return [];
      }
      return [
        {
          field: refinement.field,
          message: refinement.message,
          source: refinement.field ? ("field" as const) : ("form" as const),
          stepId: refinement.field
            ? this.getStepIdForField(refinement.field)
            : undefined,
        },
      ];
    });
  }
}
