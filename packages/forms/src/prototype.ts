import z from "zod";

// PROTOTYPE - delete or absorb into packages/forms/core.
// Question: Does the generic field/step/when flow resolver feel right before React?
import { Form } from "./core";

interface ScheduleValues extends Record<string, unknown> {
  joiningPeople: { name: string }[];
  name: string;
  neighborhood: string;
  phone: string;
  whoFor: "grandparents" | "parents" | "self";
  willAnyoneJoin: boolean;
}

const schedule = new Form<ScheduleValues>("digital-legacy-call")
  .field("name", {
    defaultValue: "",
    kind: "text",
    label: "Name",
    schema: z.string().min(1, "Please enter your name."),
  })
  .field("whoFor", {
    defaultValue: "parents",
    kind: "choice",
    label: "Who this is for",
    options: [
      { label: "Myself", value: "self" },
      { label: "Parents", value: "parents" },
      { label: "Grandparents", value: "grandparents" },
    ],
    schema: z.enum(["self", "parents", "grandparents"]),
  })
  .field("willAnyoneJoin", {
    defaultValue: false,
    kind: "choice",
    label: "Anyone joining",
    options: [
      { label: "Yes", value: true },
      { label: "No", value: false },
    ],
    schema: z.boolean(),
  })
  .field("joiningPeople", {
    defaultValue: [],
    kind: "people-list",
    label: "People joining",
    schema: z
      .array(
        z.object({
          name: z.string().min(1, "Enter a name."),
        })
      )
      .min(1, "Add at least one person."),
    when: (form) => form.value("willAnyoneJoin"),
  })
  .field("phone", {
    defaultValue: "",
    kind: "tel",
    label: "Phone number",
    schema: z.string().min(7, "Please enter a phone number."),
  })
  .field("neighborhood", {
    defaultValue: "",
    kind: "search",
    label: "Neighborhood",
    optionValidation: {
      message: "Please choose a Charlotte neighborhood.",
      suggest: true,
    },
    options: [
      { label: "NoDa", value: "NoDa" },
      { label: "Dilworth", value: "Dilworth" },
      { label: "Plaza Midwood", value: "Plaza Midwood" },
    ],
    schema: z.string().min(1, "Please enter a neighborhood."),
  })
  .errors("default", {
    scope: "currentStep",
    title: "A little more detail needed.",
  })
  .errors("review", {
    scope: "submit",
    title: (form) =>
      form.value("whoFor") === "self"
        ? "Before Susan can follow up with you."
        : "Before Susan can follow up.",
  })
  .intro("intro", {
    description: "A few gentle details.",
    title: "Let's prepare for a careful conversation.",
  })
  .step("askName", {
    fields: ["name"],
    title: "What is your name?",
  })
  .step("askWhoFor", {
    fields: ["whoFor"],
    title: "Who are you hoping to prepare this for?",
  })
  .step("askWillAnyoneJoin", {
    fields: ["willAnyoneJoin"],
    title: "Would anyone else join the conversation?",
    when: (form) => {
      if (form.value("whoFor") === "self") {
        return "askPhone";
      }
      return true;
    },
  })
  .step("askJoiningPeople", {
    fields: ["joiningPeople"],
    title: (form) => {
      if (form.value("whoFor") === "parents") {
        return "Who else would join for your parents?";
      }
      return "Who else would join?";
    },
  })
  .step("askPhone", {
    fields: ["phone"],
    title: "What is the best number for a thoughtful follow-up?",
  })
  .step("askNeighborhood", {
    fields: ["neighborhood"],
    title: "What neighborhood should we keep in mind?",
  })
  .review("review", {
    title: "Review and send.",
  });

let currentStepId = "intro";
let history: string[] = [];
let values = schedule.defaults;

printState("initial");
setValue("whoFor", "self");
goTo("askWillAnyoneJoin");
next("next from askWillAnyoneJoin");
setValue("whoFor", "parents");
setValue("willAnyoneJoin", true);
goTo("askWillAnyoneJoin");
next("next with joining visible");
setValue("joiningPeople", [{ name: "Mary" }]);
setValue("willAnyoneJoin", false);
printState("hidden value persists");
printValidation(
  "current phone validation",
  schedule.validateStep({ stepId: "askPhone", values })
);
printValidation(
  "submit visible validation",
  schedule.validateSubmit({ values })
);
values = { ...values, neighborhood: "dilwroth" };
printValidation(
  "option suggestion validation",
  schedule.validateStep({ stepId: "askNeighborhood", values })
);

function goTo(stepId: string) {
  history = [...history, currentStepId];
  currentStepId = stepId;
  printState(`go ${stepId}`);
}

function next(label: string) {
  const nextStep = schedule.getNextStep({ currentStepId, values });
  history = [...history, currentStepId];
  currentStepId = nextStep?.id ?? currentStepId;
  printState(label);
}

function printState(label: string) {
  const serialized = schedule.serialize({ currentStepId, values });
  console.log(`\nSTATE ${label}`);
  console.log("values:", values);
  console.log("visibleFields:", getVisibleFieldIds());
  console.log(
    "visibleSteps:",
    schedule.getVisibleSteps({ values }).map((step) => step.id)
  );
  console.log("currentStep:", currentStepId);
  console.log(
    "next:",
    schedule.getNextStep({ currentStepId, values })?.id ?? null
  );
  console.log("history:", history);
  console.log("answers:", serialized.answers);
  console.log("messages:", serialized.messages);
  console.log("errorRegion:", schedule.evaluateErrorRegion("default", values));
}

function printValidation(
  label: string,
  result: { issues: unknown[]; ok: boolean }
) {
  console.log(`\nVALIDATION ${label}`);
  console.dir(result, { depth: null });
}

function setValue<TKey extends keyof ScheduleValues>(
  key: TKey,
  value: ScheduleValues[TKey]
) {
  values = { ...values, [key]: value };
  printState(`set ${String(key)}=${String(value)}`);
}

function getVisibleFieldIds() {
  return [...schedule.fields.keys()].filter(
    (fieldId) => schedule.evaluateField(fieldId, values).visible
  );
}
