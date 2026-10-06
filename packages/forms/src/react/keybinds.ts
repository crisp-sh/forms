import type { EvaluatedField, FormValues } from "../core";

export interface ActiveShortcut {
  fieldId: string;
  key: string;
  value: unknown;
}

interface KeybindHandlerOptions<TValues extends FormValues> {
  back: () => void;
  fields: EvaluatedField<TValues>[];
  next: () => Promise<void>;
  selectChoice: <TKey extends keyof TValues & string>(
    fieldId: TKey,
    value: TValues[TKey],
    shortcutKey?: string
  ) => void;
}

const CHOICE_SHORTCUT_KEYS = new Set([
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
]);

export function createKeybindHandler<TValues extends FormValues>({
  back,
  fields,
  next,
  selectChoice,
}: KeybindHandlerOptions<TValues>) {
  return (event: KeyboardEvent) => {
    if (shouldIgnoreKeybind(event)) {
      return;
    }
    if (handleBackShortcut(event, back)) {
      return;
    }
    if (handleNextShortcut(event, next)) {
      return;
    }
    handleChoiceShortcut(event, {
      fields,
      selectChoice,
    });
  };
}

function shouldIgnoreKeybind(event: KeyboardEvent) {
  return (
    event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
  );
}

function handleBackShortcut(event: KeyboardEvent, back: () => void) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowUp") {
    return false;
  }
  if (isEditableTarget(event.target)) {
    return true;
  }
  event.preventDefault();
  back();
  return true;
}

function handleNextShortcut(event: KeyboardEvent, next: () => Promise<void>) {
  if (
    event.key !== "ArrowRight" &&
    event.key !== "ArrowDown" &&
    event.key !== "Enter"
  ) {
    return false;
  }
  if (isEditableTarget(event.target) && event.key !== "Enter") {
    return true;
  }
  if (isTextareaTarget(event.target) && event.shiftKey) {
    return true;
  }
  event.preventDefault();
  void next();
  return true;
}

function handleChoiceShortcut<TValues extends FormValues>(
  event: KeyboardEvent,
  {
    fields,
    selectChoice,
  }: Omit<KeybindHandlerOptions<TValues>, "back" | "next">
) {
  if (!CHOICE_SHORTCUT_KEYS.has(event.key) || isEditableTarget(event.target)) {
    return;
  }
  const choiceField =
    fields.length === 1 && fields[0]?.kind === "choice" ? fields[0] : null;
  const option = choiceField?.optionsList?.[Number(event.key) - 1];
  if (!choiceField || !option) {
    return;
  }
  event.preventDefault();
  selectChoice(choiceField.id, option.value, event.key);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest("input, textarea, select, [contenteditable=true]")
  );
}

function isTextareaTarget(target: EventTarget | null) {
  return target instanceof HTMLTextAreaElement;
}
