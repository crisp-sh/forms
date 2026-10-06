import assert from "node:assert/strict";
import { test } from "node:test";

import { inquiry } from "../examples/react/src/form";

test("required answers block progress and submission", () => {
  assert.equal(
    inquiry.validateStep({ stepId: "name", values: inquiry.defaults }).ok,
    false
  );
  assert.equal(inquiry.validateSubmit({ values: inquiry.defaults }).ok, false);
});

test("team questions follow the selected path and hidden answers stay out of the payload", () => {
  const values = {
    ...inquiry.defaults,
    name: "Alex",
    audience: "team" as const,
  };
  assert.equal(
    inquiry.getNextStep({ currentStepId: "audience", values })?.id,
    "team"
  );
  assert.equal(inquiry.validateSubmit({ values }).ok, false);
  const individual = {
    ...values,
    audience: "individual" as const,
    team: "Previous answer",
  };
  assert.equal(
    inquiry.getNextStep({ currentStepId: "audience", values: individual })?.id,
    "review"
  );
  assert.equal(inquiry.validateSubmit({ values: individual }).ok, true);
  assert.equal(
    inquiry
      .serialize({ values: individual })
      .answers.some((answer) => answer.field === "team"),
    false
  );
});

test("a complete team inquiry produces labeled answers and conversational messages", () => {
  const values = { name: "Alex", audience: "team" as const, team: "Design" };
  assert.equal(inquiry.validateSubmit({ values }).ok, true);
  const payload = inquiry.serialize({ currentStepId: "review", values });
  assert.equal(payload.formId, "project-inquiry");
  assert.deepEqual(
    payload.answers.map(({ field, value }) => ({ field, value })),
    [
      { field: "name", value: "Alex" },
      { field: "audience", value: "team" },
      { field: "team", value: "Design" },
    ]
  );
  assert.ok(
    payload.messages.some(
      (message) => message.role === "user" && message.content === "Alex"
    )
  );
});
