import assert from "node:assert/strict";
import { test } from "node:test";

import { providers } from "../examples/react/src/providers";

for (const [provider, { form: inquiry }] of Object.entries(providers)) {
  test(`${provider}: required answers block progress and submission`, async () => {
    const step = await inquiry.validateStep({
      stepId: "name",
      values: inquiry.defaults,
    });
    const submission = await inquiry.validateSubmit({
      values: inquiry.defaults,
    });
    assert.equal(step.ok, false);
    assert.equal(submission.ok, false);
  });

  test(`${provider}: team questions follow the selected path and hidden answers stay out of the payload`, async () => {
    const values = {
      ...inquiry.defaults,
      name: "Alex",
      audience: "team" as const,
    };
    assert.equal(
      inquiry.getNextStep({ currentStepId: "audience", values })?.id,
      "team"
    );
    const team = await inquiry.validateSubmit({ values });
    assert.equal(team.ok, false);
    const individual = {
      ...values,
      audience: "individual" as const,
      team: "Previous answer",
    };
    assert.equal(
      inquiry.getNextStep({ currentStepId: "audience", values: individual })
        ?.id,
      "review"
    );
    const single = await inquiry.validateSubmit({ values: individual });
    assert.equal(single.ok, true);
    assert.equal(
      inquiry
        .serialize({ values: individual })
        .answers.some((answer) => answer.field === "team"),
      false
    );
  });

  test(`${provider}: a complete team inquiry produces labeled answers and conversational messages`, async () => {
    const values = { name: "Alex", audience: "team" as const, team: "Design" };
    const result = await inquiry.validateSubmit({ values });
    assert.equal(result.ok, true);
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
}
