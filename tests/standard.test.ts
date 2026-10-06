import assert from "node:assert/strict";
import { test } from "node:test";

import { Form } from "@crisp-sh/forms";
import type { StandardSchemaV1 } from "@standard-schema/spec";

const asyncText: StandardSchemaV1<string> = {
  "~standard": {
    version: 1,
    vendor: "test-only-standard-schema",
    validate: (value) =>
      Promise.resolve(
        typeof value === "string" && value.trim()
          ? { value }
          : { issues: [{ message: "Required", path: [{ key: "nested" }, 0] }] }
      ),
  },
};

test("validation consumes only Standard Schema and awaits async issues", async () => {
  const form = new Form<{ name: string }>("async")
    .field("name", {
      defaultValue: "",
      kind: "text",
      label: "Name",
      schema: asyncText,
    })
    .step("name", { fields: ["name"], title: "Name" });
  const invalid = await form.validateStep({
    stepId: "name",
    values: { name: "" },
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.issues[0], {
    field: "name",
    source: "field",
    stepId: "name",
    message: "Required",
    path: ["name", "nested", 0],
  });
  const valid = await form.validateSubmit({ values: { name: "Alex" } });
  assert.equal(valid.ok, true);
});

test("combined schema preserves transformed outputs and rejects non-objects", async () => {
  const number: StandardSchemaV1<string, number> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => Promise.resolve({ value: Number(value) }),
    },
  };
  const form = new Form<{ age: string }>("transform").field("age", {
    defaultValue: "",
    kind: "text",
    label: "Age",
    schema: number,
  });
  assert.deepEqual(await form.schema["~standard"].validate({ age: "42" }), {
    value: { age: 42 },
  });
  const invalid = await form.schema["~standard"].validate(null);
  assert.ok(invalid.issues);
});

test("choice fields require explicit options rather than provider introspection", () => {
  assert.throws(
    () =>
      new Form<{ name: string }>("choices").field("name", {
        defaultValue: "",
        kind: "choice",
        label: "Name",
        schema: asyncText,
      }),
    /explicit options/
  );
});

test("async schemas validate configured options outside render", async () => {
  const form = new Form<{ name: string }>("choices")
    .field("name", {
      defaultValue: "Alex",
      kind: "choice",
      label: "Name",
      schema: asyncText,
      options: [{ label: "Invalid", value: "" }],
    })
    .step("name", { fields: ["name"], title: "Name" });
  assert.doesNotThrow(() => form.evaluateField("name", form.defaults));
  await assert.rejects(
    form.validateSubmit({ values: form.defaults }),
    /Option.*does not match schema/
  );
});

test("rejected validators propagate instead of passing validation", async () => {
  const form = new Form<{ name: string }>("rejected")
    .field("name", {
      defaultValue: "",
      kind: "text",
      label: "Name",
      schema: {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: () => Promise.reject(new Error("offline")),
        },
      },
    })
    .step("name", { fields: ["name"], title: "Name" });
  await assert.rejects(
    form.validateSubmit({ values: form.defaults }),
    /offline/
  );
});
