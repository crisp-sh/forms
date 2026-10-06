import type { FieldId } from "@simplysusan/forms";
import {
  FormProvider,
  useConversationForm,
  useFieldA11y,
  useFormProgress,
} from "@simplysusan/forms/react";

import { inquiry } from "./form";
import type { InquiryValues } from "./form";

export function App() {
  // With no transport, completion stays local. Add transport.submit to connect an API.
  return (
    <FormProvider form={inquiry} enableKeybinds={false}>
      <Conversation />
    </FormProvider>
  );
}

function Conversation() {
  const conversation = useConversationForm<InquiryValues>();
  const progress = useFormProgress<InquiryValues>();
  const { currentStep, fields, submitStatus, serialize } = conversation;
  const complete = submitStatus === "submitted";

  return (
    <main>
      <header>
        <a className="brand" href="/">
          forms<span>.</span>
        </a>
        <span>React example</span>
      </header>
      <div className="workspace">
        <section aria-label="Project inquiry">
          <p className="eyebrow">{complete ? "Complete" : progress.label}</p>
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
                  <button type="submit">
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
            Typed fields, Zod validation, conditional steps, and structured
            answers. All driven by one form definition.
          </p>
          <p>
            Choose “My team” to reveal an extra question. Use Back to change
            your answers.
          </p>
          <details open={complete}>
            <summary>{complete ? "Completed payload" : "Live payload"}</summary>
            <pre>{JSON.stringify(serialize(), null, 2)}</pre>
          </details>
        </aside>
      </div>
      <footer>
        Built with @simplysusan/forms{" "}
        <span>Local demo · no account required</span>
      </footer>
    </main>
  );
}

function Field({ fieldId }: { fieldId: FieldId<InquiryValues> }) {
  const { values, setValue } = useConversationForm<InquiryValues>();
  const a11y = useFieldA11y<InquiryValues, typeof fieldId>(fieldId);
  const field = inquiry.evaluateField(fieldId, values);

  if (fieldId === "audience") {
    return (
      <fieldset>
        <legend>{field.labelText}</legend>
        {inquiry
          .evaluateField("audience", values)
          .optionsList?.map((option) => (
            <label className="choice" key={String(option.value)}>
              <input
                type="radio"
                aria-label={option.label}
                name="audience"
                value={String(option.value)}
                checked={values.audience === option.value}
                onChange={() =>
                  setValue(
                    "audience",
                    option.value as InquiryValues["audience"]
                  )
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
