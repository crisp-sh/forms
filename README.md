# Forms

Headless conversational forms built on TanStack Form, React, and Zod. Includes a runnable React example with validation, conditional questions, review, and serialized answers.

## Run the example

Use Node.js 24 or newer and npm 11.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Choose **My team** to reveal the conditional team-name question. Back navigation preserves answers; Finish displays the completed payload. The demo keeps state in memory: refresh resets it, and nothing is sent to a server.

## Layout

- `packages/forms`: original implementation, copied verbatim from `crisp-sh/simplysusan` at commit `76e6f83ba6ec6e61aa1c5998b6fa7be71509fe9a`.
- `packages/config`: original TypeScript configuration required by the package.
- `examples/react/src/form.ts`: typed form definition, Zod schemas, and conditional field visibility.
- `examples/react/src/app.tsx`: provider, accessible field rendering, navigation, review, and payload preview.
- `tests`: behavior checks for the example and SHA-256 verification of every extracted package file.

The original `@simplysusan/forms` package name, `private` flag, source exports, and dependency declarations are intentionally retained. This is an npm workspace with TypeScript source exports, not a published npm package. Import the React bindings separately from the core:

```tsx
import { Form } from "@simplysusan/forms";
import { FormProvider, useConversationForm } from "@simplysusan/forms/react";
```

`FormProvider` accepts optional `transport.save` and `transport.submit` functions. Each receives `(serializedForm, values)` and returns `Promise<void>`. The example omits transport, so completion is local. To integrate a backend, provide your own transport and validate submissions server-side. For draft persistence, pass a `persistence` key; the package stores drafts in local storage. See the exported types in `packages/forms/src/react/provider.tsx` and `persistence.ts`.

## Verify

```sh
npm run verify
```

Runs formatting, lint, workspace type checks, Node tests, and the example production build. CI runs the same gate. Build output is `examples/react/dist`.

`scripts/upstream.json` records the source commit and SHA-256 hashes. Keep `packages/forms` unchanged while this repository represents the verbatim extraction. Any future intentional SDK changes must update this provenance contract explicitly.

Dependencies use the source repository's direct resolved versions. A root override pins the formatter's transitive `tinypool` dependency to patched version `2.1.2`; this does not alter the forms package. Background: [TanStack Form](https://tanstack.com/form/latest/docs/overview), [Zod](https://zod.dev/), and [Vite](https://vite.dev/guide/).
