import { Form } from "@crisp-sh/forms";
import { FormProvider as AtomFormProvider } from "@crisp-sh/forms/atom";
import { FormProvider, useConversationForm } from "@crisp-sh/forms/react";
import { RegistryProvider, useAtom } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";

// Deliberately slow, minimal Standard Schema: no provider-specific behavior to hide races.
const form = new Form<{ name: string }>("async-fixture")
  .field("name", {
    defaultValue: "",
    kind: "text",
    label: "Name",
    schema: {
      "~standard": {
        version: 1,
        vendor: "test-fixture",
        validate: async (value) => {
          // oxlint-disable-next-line promise/avoid-new -- Exercise a real browser validation delay.
          await new Promise((resolve) => {
            setTimeout(resolve, 250);
          });
          if (value === "crash") {
            throw new Error("Validator unavailable");
          }
          if (typeof value !== "string" || value.trim().length < 3) {
            return { issues: [{ message: "At least three characters." }] };
          }
          return { value };
        },
      },
    },
  })
  .step("name", { fields: ["name"], title: "Name" })
  .review("review", { title: "Review" });

const valuesAtom = Atom.make(form.defaults);

function Fixture() {
  const [submissions, setSubmissions] = useState(0);
  const finishRequest = useRef<(() => void) | null>(null);
  const params = new URLSearchParams(window.location.search);
  const atom = params.get("integration") === "atom";
  const Provider = atom ? AtomFormProvider : FormProvider;
  return (
    <RegistryProvider>
      <Provider
        valuesAtom={valuesAtom}
        form={form}
        enableKeybinds={false}
        transport={{
          submit: () => {
            setSubmissions((count) => count + 1);
            if (params.get("transport") === "manual") {
              // oxlint-disable-next-line promise/avoid-new -- Let the test resolve an in-flight transport explicitly.
              return new Promise<void>((resolve) => {
                finishRequest.current = resolve;
              });
            }
            return Promise.resolve();
          },
        }}
      >
        <Controls />
        <button type="button" onClick={() => finishRequest.current?.()}>
          Finish request
        </button>
        <p data-testid="submissions">{submissions}</p>
      </Provider>
      {atom && <AtomObserver />}
    </RegistryProvider>
  );
}

function AtomObserver() {
  const [values, setValues] = useAtom(valuesAtom);
  return (
    <label>
      Shared atom name
      <input
        aria-label="Shared atom name"
        value={values.name}
        onChange={(event) => setValues({ name: event.target.value })}
      />
    </label>
  );
}

function Controls() {
  const state = useConversationForm<{ name: string }>();
  return (
    <main>
      <h1>{state.currentStep.titleText}</h1>
      <label htmlFor="name">Name</label>
      <input
        aria-label="Name"
        id="name"
        value={state.values.name}
        onChange={(event) => state.setValue("name", event.target.value)}
      />
      <output>{state.isPending ? "Pending" : "Idle"}</output>
      <p data-testid="status">{state.submitStatus}</p>
      {state.issues.map((issue) => (
        <p key={issue.message} role="alert">
          {issue.message}
        </p>
      ))}
      {/* Intentionally enabled: the SDK must guard concurrent calls, not just its demo UI. */}
      <button
        type="button"
        onClick={() => {
          void state.next();
        }}
      >
        Continue
      </button>
      <button
        type="button"
        onClick={() => {
          void state.submit();
        }}
      >
        Submit
      </button>
      <button type="button" onClick={state.back}>
        Back
      </button>
    </main>
  );
}

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root.");
}
createRoot(root).render(<Fixture />);
