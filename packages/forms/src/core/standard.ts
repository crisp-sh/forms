import type { StandardSchemaV1 } from "@standard-schema/spec";

/** Compose field validators through the public Standard Schema protocol only. */
export function objectSchema<TInput>(
  fields: Record<string, StandardSchemaV1>
): StandardSchemaV1<TInput, Record<string, unknown>> {
  return {
    "~standard": {
      version: 1,
      vendor: "crisp-forms",
      validate: async (input) => {
        if (
          typeof input !== "object" ||
          input === null ||
          Array.isArray(input)
        ) {
          return { issues: [{ message: "Expected an object." }] };
        }
        const values = input as Record<string, unknown>;
        const results = await Promise.all(
          Object.entries(fields).map(async ([key, schema]) => ({
            key,
            result: await schema["~standard"].validate(values[key]),
          }))
        );
        const issues = results.flatMap(({ key, result }) =>
          (result.issues ?? []).map((issue) => ({
            ...issue,
            path: [key, ...(issue.path ?? [])],
          }))
        );
        if (results.some(({ result }) => result.issues)) {
          return { issues };
        }
        return {
          value: Object.fromEntries(
            results.map(({ key, result }) => [
              key,
              "value" in result ? result.value : undefined,
            ])
          ),
        };
      },
    },
  };
}
