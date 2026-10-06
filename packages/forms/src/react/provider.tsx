import { useForm, useStore } from "@tanstack/react-form";
import { useCallback } from "react";

import type { FormValues } from "../core";
import type { FormProviderProps } from "./context";
import { ConversationProvider } from "./conversation";

export type {
  FormProviderProps,
  FormTransport,
  SaveStatus,
  SubmitStatus,
  ConversationContextValue,
} from "./context";
export { useFormContext } from "./context";

/** TanStack Form-backed React integration. Keep the form definition stable across renders. */
export function FormProvider<TValues extends FormValues>(
  props: FormProviderProps<TValues>
) {
  const form = useForm({ defaultValues: props.form.defaults });
  const values = useStore(form.store, (state) => state.values);
  const setFieldValue = useCallback(
    <TKey extends keyof TValues & string>(key: TKey, value: TValues[TKey]) => {
      form.setFieldValue(key, value as never);
    },
    [form]
  );
  return <ConversationProvider {...props} store={{ values, setFieldValue }} />;
}
