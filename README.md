# @crisp-sh/forms

Headless conversational forms with Standard Schema validation. Use Zod, Effect Schema, TypeBox, or any validator implementing `StandardSchemaV1`. React integrations support both TanStack Form and Effect Atom.

[Live demo](https://crisp-sh.github.io/forms/) · [Verification and deployment](https://github.com/crisp-sh/forms/actions/workflows/verify.yml)

The live demo has separate selectors for the React integration and schema provider. Try TanStack Form or Effect Atom with Zod, Effect, and TypeBox; both integrations support the same validation, conditional questions, and completion flow.

## Run the examples

Use Node.js 24 or newer and npm 11.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Select a **Schema provider** and **React integration**. All six combinations use the same form definition and UI. Choose **My team** to reveal a conditional question; edit the completed form to try another branch. Answers stay in the browser tab; refresh resets them. No backend or account is needed.

| Provider       | Schema passed to the SDK                | Example                                             |
| -------------- | --------------------------------------- | --------------------------------------------------- |
| Zod 4.4.3      | Native Standard Schema implementation   | [zod.ts](examples/react/src/schemas/zod.ts)         |
| Effect 4.0.1   | `Schema.toStandardSchemaV1(schema)`     | [effect.ts](examples/react/src/schemas/effect.ts)   |
| TypeBox 1.3.36 | Explicit adapter over `Compile(schema)` | [typebox.ts](examples/react/src/schemas/typebox.ts) |

The Effect example uses a real asynchronous decoder. TypeBox keeps schematics separate from validation; its example-side adapter implements the standard using TypeBox's compiler, decoded output, and JSON Pointer errors. The SDK never inspects provider internals.

## Define a form

```tsx
import { Form } from "@crisp-sh/forms";
import z from "zod";

const form = new Form<{ name: string }>("hello")
  .field("name", {
    kind: "text",
    label: "Your name",
    defaultValue: "",
    schema: z.string().min(1, "Enter your name."),
  })
  .step("name", { fields: ["name"], title: "What is your name?" })
  .review("review", { title: "Review your answer" });
```

Fields accept `StandardSchemaV1<TInput, unknown>`; `TInput` describes editable values. Both synchronous and asynchronous validators work. `validateStep` and `validateSubmit` always return promises. Issues preserve their provider message and normalize nested paths, prefixed with the field id.

```ts
const result = await form.validateSubmit({ values: { name: "Alex" } });
if (result.ok) {
  const payload = form.serialize({ values: { name: "Alex" } });
}
```

Choice fields require explicit `options`. Standard Schema has no enum metadata, so options are never inferred from schema internals. Configured option values are checked during validation, never during render. Hidden fields are omitted from submission validation and serialization by default.

Validation does **not** mutate editable values or silently apply transforms to drafts or transport payloads. To obtain provider-transformed output explicitly, call `await form.schema["~standard"].validate(input)`. This aggregate validates **all registered fields**, including hidden ones, and returns transformed values as `Record<string, unknown>`; it does not run form-level refinements. Use `validateSubmit` for the visible-field/refinement policy.

`serializedFormInput`, `serializedFormAnswerInput`, and `serializedFormMessageInput` are also Standard Schema validators. They validate the SDK's transport envelope and retain the supplied object. They do not validate application-specific answers; validate those against your form contract on the server.

## TanStack Form integration

Install `react` and `@tanstack/react-form` in the consuming application. Keep the form definition stable across renders.

```tsx
import { FormProvider, useConversationForm } from "@crisp-sh/forms/react";

<FormProvider form={form}>
  <Conversation />
</FormProvider>;
```

## Effect Atom integration

Install matching `effect@^4.0.1`, `@effect/atom-react@^4.0.1`, and React 19. TanStack Form is optional for this entry point.

```tsx
import { RegistryProvider } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import { FormProvider, useConversationForm } from "@crisp-sh/forms/atom";

const valuesAtom = Atom.make(form.defaults);

<RegistryProvider>
  <FormProvider form={form} valuesAtom={valuesAtom}>
    <Conversation />
  </FormProvider>
</RegistryProvider>;
```

A supplied `valuesAtom` lets other `useAtom` / `useAtomValue` consumers read or edit the same state inside that registry. Omit it to let the provider create an atom for its own form instance. The Atom integration stores editable values in the atom; both integrations share React-managed navigation, validation, and status behavior. Provider changes should remount the form, as the example does with a React `key`.

Both entries export the same conversation, progress, accessibility, array-field, navigation, serialization, and status hooks. `useConversationForm().isPending` covers validation and navigation/submission work. Repeated in-flight actions are ignored; editing values or going back invalidates stale validation results. Once a transport request has been sent, navigation cannot cancel it; its outcome is still recorded. Completed submissions require `editSubmission()` before sending again. Validator exceptions surface as a retryable form error.

`FormProvider` accepts optional `transport.save` and `transport.submit` functions. Each receives `(serializedForm, values)` and returns `Promise<void>`. To persist drafts, provide a `persistence` key; the SDK uses local storage. Transport, persistence, and keyboard behavior are shared between integrations. The example disables SDK keybindings and uses native form submission for Enter.

## Verification

```sh
npx playwright install chromium
npm run verify
```

`verify` runs formatting, lint, TypeScript checks (including test code), Node tests, the example production build, and Playwright Chromium tests. CI installs Chromium and runs the same gate. On Linux CI, use `npx playwright install --with-deps chromium` for browser system dependencies.

```sh
npm test          # core contracts, providers, adapters, and dependency boundary
npm run test:e2e  # browser flows and async lifecycle tests
```

Playwright covers every provider/integration combination on desktop and a mobile viewport: validation errors, whitespace input, conditional questions, review, completion payloads, editing, and Enter submission. Additional browser fixtures cover rejected validators, stale results after edits or Back, repeated clicks, and external atom updates. Traces are retained in `test-results` on failure.

## GitHub Pages

Pushes to `main` run the full verification gate, upload the verified production build, and deploy it to GitHub Pages. The deployment job then runs the 12 provider/integration browser tests against the live URL. Pull requests only verify; they do not deploy.

Vite uses `/forms/` in development and production so local tests exercise the same asset and navigation paths as Pages. To repeat the live checks:

```sh
PLAYWRIGHT_BASE_URL=https://crisp-sh.github.io/forms/ npm run test:e2e
```

Supplying `PLAYWRIGHT_BASE_URL` disables the local server and selects only the provider matrix. Async test fixtures are not included in the published build. Deployment follows the [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite project-site base path](https://vite.dev/guide/static-deploy.html#github-pages) guidance.

## Layout and provenance

- `packages/forms/src/core`: Standard Schema-based engine; no schema-provider runtime dependencies.
- `packages/forms/src/react`: TanStack adapter and shared React conversation lifecycle.
- `packages/forms/src/atom`: Effect Atom adapter.
- `examples/react`: runnable provider/integration matrix and original prototype.
- `tests`: core and Playwright coverage.
- `packages/config`: shared TypeScript configuration.

The package started as a verbatim extraction from `crisp-sh/simplysusan` commit `76e6f83ba6ec6e61aa1c5998b6fa7be71509fe9a`. `scripts/upstream.json` retains that snapshot's hashes as historical provenance. The SDK has since been renamed and generalized; those hashes no longer describe the current package. The original Zod prototype now lives under the example.

This repository uses npm workspaces and TypeScript source exports. The package remains private in its manifest and has not been published to npm. The old `@simplysusan/forms` import is replaced by `@crisp-sh/forms`; synchronous validation calls and Zod `.parse` / `.safeParse` calls on exported schema helpers must migrate to the Standard Schema interface above.

References: [Standard Schema](https://standardschema.dev/schema), [Effect Schema](https://effect.website/docs/v4/schema/standard-schema), [Zod for library authors](https://zod.dev/library-authors), [TypeBox](https://github.com/sinclairzx81/typebox).
