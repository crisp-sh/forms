import { Form } from "@crisp-sh/forms";
import type { StandardSchemaV1 } from "@standard-schema/spec";

// A type alias satisfies Form's Record constraint while preserving exact field keys.
// oxlint-disable-next-line typescript/consistent-type-definitions
export type InquiryValues = {
  name: string;
  audience: "individual" | "team";
  team: string;
};

export type InquirySchemas = {
  [Key in keyof InquiryValues]: StandardSchemaV1<InquiryValues[Key], unknown>;
};

// Every provider shares exactly the same form definition and React renderer.
export function createInquiry(schemas: InquirySchemas) {
  return new Form<InquiryValues>("project-inquiry")
    .field("name", {
      defaultValue: "",
      kind: "text",
      label: "Your name",
      schema: schemas.name,
    })
    .field("audience", {
      defaultValue: "individual",
      kind: "choice",
      label: "Who is this for?",
      options: [
        { label: "Just me", value: "individual" },
        { label: "My team", value: "team" },
      ],
      schema: schemas.audience,
    })
    .field("team", {
      defaultValue: "",
      kind: "text",
      label: "Team name",
      schema: schemas.team,
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
}
