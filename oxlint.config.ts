import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  ignorePatterns: [
    ...core.ignorePatterns,
    ".agents/**",
    ".claude/**",
    ".codex/**",
  ],
  rules: {
    "arrow-body-style": "allow",
    "func-style": "allow",
    "import/no-duplicates": "allow",
    "jsx-a11y/label-has-associated-control": "allow",
    "no-duplicate-imports": "allow",
    "no-inline-comments": "allow",
    "no-nested-ternary": "allow",
    "no-use-before-define": "allow",
    "node/callback-return": "allow",
    "oxc/no-barrel-file": "allow",
    "require-unicode-regexp": "allow",
    "sort-keys": "allow",
    "typescript/no-empty-interface": "allow",
    "typescript/no-empty-object-type": "allow",
    "typescript/no-explicit-any": "allow",
    "typescript/no-non-null-assertion": "allow",
    "typescript/triple-slash-reference": "allow",
    "unicorn/consistent-function-scoping": "allow",
    "unicorn/no-nested-ternary": "allow",
  },
});
