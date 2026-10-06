import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Type } from "typebox";
import type { StaticDecode, StaticEncode, TSchema } from "typebox";
import { Compile } from "typebox/compile";

import type { InquirySchemas } from "../form";

/** TypeBox separates schemas from validators; adapt its compiler explicitly. */
export function standardTypeBox<T extends TSchema>(
  schema: T
): StandardSchemaV1<StaticEncode<T>, StaticDecode<T>> {
  const validator = Compile(schema);
  return {
    "~standard": {
      version: 1,
      vendor: "typebox",
      validate: (value) => {
        if (validator.Check(value)) {
          return { value: validator.Decode(value) };
        }
        return {
          issues: validator.Errors(value).map((issue) => ({
            message: issue.message,
            // JSON Pointer escaping is independent of Standard Schema path segments.
            path:
              issue.instancePath === ""
                ? []
                : issue.instancePath
                    .slice(1)
                    .split("/")
                    .map((key) =>
                      key.replaceAll("~1", "/").replaceAll("~0", "~")
                    ),
          })),
        };
      },
    },
  };
}

export const typeboxSchemas = {
  name: standardTypeBox(Type.String({ pattern: "\\S" })),
  audience: standardTypeBox(
    Type.Union([Type.Literal("individual"), Type.Literal("team")])
  ),
  team: standardTypeBox(Type.String({ pattern: "\\S" })),
} satisfies InquirySchemas;
