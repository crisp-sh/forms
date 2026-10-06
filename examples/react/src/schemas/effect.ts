import { Effect, Schema, SchemaGetter } from "effect";

import type { InquirySchemas } from "../form";

// Effect's official adapter: https://effect.website/docs/v4/schema/standard-schema
// The real async decoder exercises the SDK's pending state and navigation guards.
export const effectSchemas = {
  name: Schema.toStandardSchemaV1(
    Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(
          Schema.isPattern(/\S/, { message: "Enter your name to continue." })
        ),
        {
          decode: SchemaGetter.transformEffect((value) =>
            Effect.succeed(value).pipe(Effect.delay("120 millis"))
          ),
          encode: SchemaGetter.transform((value: string) => value),
        }
      )
    )
  ),
  audience: Schema.toStandardSchemaV1(Schema.Literals(["individual", "team"])),
  team: Schema.toStandardSchemaV1(
    Schema.String.check(
      Schema.isPattern(/\S/, { message: "Enter your team name to continue." })
    )
  ),
} satisfies InquirySchemas;
