import type { FieldId } from "@crisp-sh/forms";
import { FormProvider as AtomFormProvider } from "@crisp-sh/forms/atom";
import {
  FormProvider,
  useConversationForm,
  useFieldA11y,
  useFormProgress,
} from "@crisp-sh/forms/react";
import { RegistryProvider } from "@effect/atom-react";
import { useState } from "react";

import type { InquiryValues } from "./form";
import { providers } from "./providers";
import type { Provider } from "./providers";

export function App() {
  const [provider, setProvider] = useState<Provider>("zod");
  const [integration, setIntegration] = useState<"tanstack" | "atom">(
    "tanstack"
  );
  const Provider = integration === "atom" ? AtomFormProvider : FormProvider;
  // With no transport, completion stays local. Add transport.submit to connect an API.
  return (
    <RegistryProvider>
      <Provider
        key={`${provider}:${integration}`}
        form={providers[provider].form}
        enableKeybinds={false}
      >
        <Conversation
          provider={provider}
          onProviderChange={setProvider}
          integration={integration}
          onIntegrationChange={setIntegration}
        />
      </Provider>
    </RegistryProvider>
  );
}

function Conversation({
  provider,
  onProviderChange,
  integration,
  onIntegrationChange,
}: {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  integration: "tanstack" | "atom";
  onIntegrationChange: (integration: "tanstack" | "atom") => void;
}) {
  const conversation = useConversationForm<InquiryValues>();
  const progress = useFormProgress<InquiryValues>();
  const { currentStep, fields, submitStatus, serialize } = conversation;
  const complete = submitStatus === "submitted";

  return (
    <main>
      <header>
        <a className="brand" href={import.meta.env.BASE_URL}>
          forms<span>.</span>
        </a>
        <label className="provider">
          Schema provider
          <select
            aria-label="Schema provider"
            value={provider}
            onChange={(event) =>
              onProviderChange(event.target.value as Provider)
            }
          >
            {Object.entries(providers).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="provider">
          React integration
          <select
            aria-label="React integration"
            value={integration}
            onChange={(event) =>
              onIntegrationChange(event.target.value as "tanstack" | "atom")
            }
          >
            <option value="tanstack">TanStack Form</option>
            <option value="atom">Effect Atom</option>
          </select>
        </label>
      </header>
      <div className="workspace">
        <section aria-label="Project inquiry">
          <p className="eyebrow">
            {providers[provider].label} ·{" "}
            {integration === "atom" ? "Effect Atom" : "TanStack Form"} ·{" "}
            {complete ? "Complete" : progress.label}
          </p>
          <progress
            aria-label="Form progress"
            max={100}
            value={complete ? 100 : progress.percent}
          />
          <div
            className="question"
            key={complete ? "complete" : currentStep.id}
          >
            <h1>{complete ? "All set." : currentStep.titleText}</h1>
            <p className="description">
              {complete
                ? "Your completed payload is ready to inspect below. Nothing was sent to a server."
                : currentStep.descriptionText}
            </p>
            {complete ? (
              <button type="button" onClick={conversation.editSubmission}>
                Edit answers
              </button>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void conversation.next();
                }}
              >
                {fields.map((field) => (
                  <Field key={field.id} fieldId={field.id} />
                ))}
                {currentStep.kind === "review" && (
                  <dl>
                    {serialize().answers.map((answer) => (
                      <div key={answer.field}>
                        <dt>{answer.label}</dt>
                        <dd>
                          {answer.field === "audience"
                            ? answer.value === "team"
                              ? "My team"
                              : "Just me"
                            : String(answer.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {conversation.issues
                  .filter((issue) => !issue.field)
                  .map((issue) => (
                    <p key={issue.message} role="alert" className="error">
                      {issue.message}
                    </p>
                  ))}
                {conversation.isPending && <output>Validating…</output>}
                <nav aria-label="Form navigation">
                  {conversation.canBack && (
                    <button
                      className="secondary"
                      type="button"
                      onClick={conversation.back}
                    >
                      Back
                    </button>
                  )}
                  <button type="submit" disabled={conversation.isPending}>
                    {currentStep.kind === "intro"
                      ? "Start example"
                      : currentStep.kind === "review"
                        ? "Finish example"
                        : "Continue"}
                    <span aria-hidden="true"> →</span>
                  </button>
                </nav>
              </form>
            )}
          </div>
        </section>
        <aside>
          <p className="eyebrow">Inside this example</p>
          <h2>
            A headless form.
            <br />
            Your interface.
          </h2>
          <p>
            One form, three schema providers. Validation, conditional steps, and
            structured answers use the same Standard Schema contract.
          </p>
          <p>
            Switch between TanStack Form and Effect Atom using the React
            integration selector. Both run the same form from start to finish.
          </p>
          <p>
            Choose “My team” to reveal an extra question. Use Back to change
            your answers.
          </p>
          <details open={complete}>
            <summary>{complete ? "Completed payload" : "Live payload"}</summary>
            <pre data-testid="payload">
              {JSON.stringify(serialize(), null, 2)}
            </pre>
          </details>
        </aside>
      </div>
      <footer>
        Built with @crisp-sh/forms{" "}
        <span>Interactive demo · no account required</span>
      </footer>
    </main>
  );
}

function Field({ fieldId }: { fieldId: FieldId<InquiryValues> }) {
  const { values, setValue, form } = useConversationForm<InquiryValues>();
  const a11y = useFieldA11y<InquiryValues, typeof fieldId>(fieldId);
  const field = form.evaluateField(fieldId, values);

  if (fieldId === "audience") {
    return (
      <fieldset>
        <legend>{field.labelText}</legend>
        {form.evaluateField("audience", values).optionsList?.map((option) => (
          <label className="choice" key={String(option.value)}>
            <input
              type="radio"
              aria-label={option.label}
              name="audience"
              value={String(option.value)}
              checked={values.audience === option.value}
              onChange={() =>
                setValue("audience", option.value as InquiryValues["audience"])
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <div className="field">
      <label htmlFor={a11y.inputId}>{field.labelText}</label>
      <input
        {...a11y.controlProps}
        type="text"
        autoComplete={fieldId === "name" ? "given-name" : "organization"}
        value={values[fieldId]}
        onChange={(event) => setValue(fieldId, event.target.value)}
      />
      {a11y.issue && (
        <p {...a11y.errorProps} className="error" role="alert">
          {a11y.issue.message}
        </p>
      )}
    </div>
  );
}
