import { Form } from "@simplysusan/forms";
import z from "zod";

// A type alias satisfies Form's Record constraint while preserving exact field keys.
// oxlint-disable-next-line typescript/consistent-type-definitions
export type InquiryValues = {
  name: string;
  audience: "individual" | "team";
  team: string;
};

// The definition owns validation and branching; React only renders its current state.
export const inquiry = new Form<InquiryValues>("project-inquiry")
  .field("name", {
    defaultValue: "",
    kind: "text",
    label: "Your name",
    schema: z.string().trim().min(1, "Enter your name to continue."),
  })
  .field("audience", {
    defaultValue: "individual",
    kind: "choice",
    label: "Who is this for?",
    options: [
      { label: "Just me", value: "individual" },
      { label: "My team", value: "team" },
    ],
    schema: z.enum(["individual", "team"]),
  })
  .field("team", {
    defaultValue: "",
    kind: "text",
    label: "Team name",
    schema: z.string().trim().min(1, "Enter your team name to continue."),
    when: (form) => form.value("audience") === "team",
  })
  .intro("intro", {
    title: "One question at a time.",
    description:
      "Try a short project inquiry. Your answers stay in this browser tab.",
  })
  .step("name", { fields: ["name"], title: "What should we call you?" })
  .step("audience", {
    fields: ["audience"],
    title: "Who are you planning for?",
  })
  .step("team", { fields: ["team"], title: "What is your team called?" })
  .review("review", {
    title: "Everything look right?",
    description: "Review your answers, then finish the example.",
  });
