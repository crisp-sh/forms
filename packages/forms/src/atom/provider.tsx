import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import { useCallback, useMemo } from "react";

import type { FormValues } from "../core";
import type { FormProviderProps } from "../react/context";
import { ConversationProvider } from "../react/conversation";

/**
 * Effect Atom-backed values with the same conversation hooks as the TanStack entry.
 * Mount under @effect/atom-react's RegistryProvider. Pass a stable valuesAtom to share
 * state with other atom consumers; otherwise this provider owns its values atom.
 */
export function FormProvider<TValues extends FormValues>({
  valuesAtom,
  ...props
}: FormProviderProps<TValues> & {
  valuesAtom?: Atom.Writable<TValues, TValues>;
}) {
  const atom = useMemo(
    () => valuesAtom ?? Atom.make(props.form.defaults),
    [props.form, valuesAtom]
  );
  const [values, setValues] = useAtom(atom);
  const setFieldValue = useCallback(
    <TKey extends keyof TValues & string>(key: TKey, value: TValues[TKey]) => {
      setValues((current) => ({ ...current, [key]: value }));
    },
    [setValues]
  );
  return <ConversationProvider {...props} store={{ values, setFieldValue }} />;
}
