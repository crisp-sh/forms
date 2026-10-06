import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

import upstream from "../scripts/upstream.json";

test("the extracted forms package remains byte-for-byte identical to upstream", () => {
  const paths = readdirSync("packages/forms", {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`)
    .toSorted();
  assert.deepEqual(paths, Object.keys(upstream.files).toSorted());
  for (const [path, expected] of Object.entries(upstream.files)) {
    assert.equal(
      createHash("sha256").update(readFileSync(path)).digest("hex"),
      expected,
      path
    );
  }
});
