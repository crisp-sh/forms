import assert from "node:assert/strict";
import { test } from "node:test";

import { Form, serializedFormInput } from "@crisp-sh/forms";
import { Type } from "typebox";

import { createInquiry } from "../examples/react/src/form";
import { effectSchemas } from "../examples/react/src/schemas/effect";
import {
  standardTypeBox,
  typeboxSchemas,
} from "../examples/react/src/schemas/typebox";
import { zodSchemas } from "../examples/react/src/schemas/zod";

test("fields from different providers coexist in one form", async () => {
  const form = createInquiry({
    name: effectSchemas.name,
    audience: zodSchemas.audience,
    team: typeboxSchemas.team,
  });
  const invalid = await form.validateSubmit({
    values: { name: "Alex", audience: "team", team: " " },
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.issues[0]?.field, "team");
  const valid = await form.validateSubmit({
    values: { name: "Alex", audience: "team", team: "Design" },
  });
  assert.equal(valid.ok, true);
});

test("TypeBox adapter converts nested JSON Pointer issue paths", async () => {
  const schema = standardTypeBox(
    Type.Object({ "a/b~c": Type.Array(Type.Number()) })
  );
  const result = await schema["~standard"].validate({ "a/b~c": ["wrong"] });
  assert.deepEqual(result.issues?.[0]?.path, ["a/b~c", "0"]);
});

test("validation preserves editable input while aggregate schema exposes transformed output", async () => {
  const form = createInquiry(zodSchemas);
  const values = {
    name: "  Alex  ",
    audience: "team" as const,
    team: "Design",
  };
  const valid = await form.validateSubmit({ values });
  assert.equal(valid.ok, true);
  assert.equal(form.serialize({ values }).answers[0]?.value, "  Alex  ");
  const parsed = await form.schema["~standard"].validate(values);
  assert.deepEqual(parsed, {
    value: { name: "Alex", audience: "team", team: "Design" },
  });
});

test("transport envelope helpers validate without importing a schema provider", async () => {
  const payload = createInquiry(zodSchemas).serialize({
    values: { name: "Alex", audience: "individual", team: "" },
  });
  assert.deepEqual(await serializedFormInput["~standard"].validate(payload), {
    value: payload,
  });
  const invalid = await serializedFormInput["~standard"].validate({
    ...payload,
    messages: [{ role: "invalid", content: "text" }],
  });
  assert.ok(invalid.issues);
});

test("a failure with an empty issues array cannot allow navigation", async () => {
  const form = new Form<{ name: string }>("empty-issues")
    .field("name", {
      kind: "text",
      label: "Name",
      defaultValue: "",
      schema: {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: () => ({ issues: [] }),
        },
      },
    })
    .step("name", { fields: ["name"], title: "Name" });
  await assert.rejects(
    form.validateStep({ stepId: "name", values: form.defaults }),
    /failure without an issue/
  );
});
