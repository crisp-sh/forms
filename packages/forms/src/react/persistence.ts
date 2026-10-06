import { useCallback, useState } from "react";

import type { FormValues } from "../core";

const DRAFT_VERSION = 1;

export interface FormPersistenceOptions {
  clearOnSubmit?: boolean;
  key: string;
}

export interface PersistedFormDraft<TValues extends FormValues> {
  currentStepId?: string;
  history: string[];
  submitStatus?: "submitted";
  submissionKey?: string;
  values: TValues;
  version: typeof DRAFT_VERSION;
}

export function readFormDraft<TValues extends FormValues>(
  key: string,
  defaults: TValues
) {
  const item = readStorageItem(key);
  if (!item) {
    return null;
  }
  const parsed = parseStorageRecord(item);
  if (!parsed || parsed.version !== DRAFT_VERSION || !isRecord(parsed.values)) {
    return null;
  }
  return {
    currentStepId:
      typeof parsed.currentStepId === "string"
        ? parsed.currentStepId
        : undefined,
    history: Array.isArray(parsed.history)
      ? parsed.history.filter((entry) => typeof entry === "string")
      : [],
    submissionKey:
      typeof parsed.submissionKey === "string"
        ? parsed.submissionKey
        : undefined,
    submitStatus: parsed.submitStatus === "submitted" ? "submitted" : undefined,
    values: mergeDraftValues(defaults, parsed.values),
    version: DRAFT_VERSION,
  } satisfies PersistedFormDraft<TValues>;
}

export function writeFormDraft<TValues extends FormValues>(
  key: string,
  draft: Omit<PersistedFormDraft<TValues>, "version">
) {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(key, JSON.stringify({ ...draft, version: DRAFT_VERSION }));
}

export function clearFormDraft(key: string) {
  getStorage()?.removeItem(key);
}

export function usePersistentSubmissionKey(key: string) {
  const [submissionKey, setSubmissionKey] = useState(() => {
    const existing = readStorageItem(key);
    if (existing) {
      return existing;
    }
    const nextKey = crypto.randomUUID();
    writeStorageItem(key, nextKey);
    return nextKey;
  });

  const resetSubmissionKey = useCallback(() => {
    const nextKey = crypto.randomUUID();
    writeStorageItem(key, nextKey);
    setSubmissionKey(nextKey);
  }, [key]);

  return [submissionKey, resetSubmissionKey] as const;
}

function mergeDraftValues<TValues extends FormValues>(
  defaults: TValues,
  values: Record<string, unknown>
) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [
      key,
      Object.hasOwn(values, key) ? values[key] : defaultValue,
    ])
  ) as TValues;
}

function readStorageItem(key: string) {
  return getStorage()?.getItem(key) ?? null;
}

function writeStorageItem(key: string, value: string) {
  getStorage()?.setItem(key, value);
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function parseStorageRecord(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (isRecord(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
