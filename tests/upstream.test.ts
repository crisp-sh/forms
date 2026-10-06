import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

import manifest from "../packages/forms/package.json";

test("the core has no schema-provider dependency or source imports", () => {
  for (const dependency of ["zod", "effect", "typebox", "@sinclair/typebox"]) {
    assert.equal(Object.hasOwn(manifest.dependencies, dependency), false);
  }
  const paths = readdirSync("packages/forms/src/core", {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`)
    .toSorted();
  for (const path of paths) {
    assert.doesNotMatch(
      readFileSync(path, "utf-8"),
      /(?:from\s*|import\s*\()["'](?:zod|effect|typebox|@sinclair\/typebox)(?:["'/])/
    );
  }
});
