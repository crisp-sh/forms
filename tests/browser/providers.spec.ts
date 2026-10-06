import { expect, test } from "@playwright/test";

for (const integration of ["TanStack Form", "Effect Atom"]) {
  for (const provider of ["Zod", "Effect", "TypeBox"]) {
    test(`${integration} / ${provider}: validation, conditional team question, review and completion`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("./");
      await expect(
        page.getByRole("combobox", { name: "React integration" })
      ).toBeVisible();
      await page
        .getByRole("combobox", { name: "React integration" })
        .selectOption({ label: integration });
      await page
        .getByRole("combobox", { name: "Schema provider" })
        .selectOption({ label: provider });
      await page.getByRole("button", { name: "Start example" }).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Your name" })
      ).toHaveAttribute("aria-invalid", "true");
      await page.getByRole("textbox", { name: "Your name" }).fill("   ");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await page.getByRole("textbox", { name: "Your name" }).fill("Alex");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("radio", { name: "My team", exact: true }).check();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "What is your team called?" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await page.getByRole("textbox", { name: "Team name" }).fill("Design");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Everything look right?" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Finish example" }).click();
      await expect(
        page.getByRole("heading", { name: "All set." })
      ).toBeVisible();
      const payload = JSON.parse(
        (await page.getByTestId("payload").textContent())!
      );
      expect(payload.answers).toEqual([
        { field: "name", label: "Your name", stepId: "name", value: "Alex" },
        {
          field: "audience",
          label: "Who is this for?",
          stepId: "audience",
          value: "team",
        },
        { field: "team", label: "Team name", stepId: "team", value: "Design" },
      ]);
      expect(payload.messages).toContainEqual({
        content: "Design",
        role: "user",
        stepId: "team",
      });

      // Changing the branch preserves editable input but removes the hidden answer from submission.
      await page.getByRole("button", { name: "Edit answers" }).click();
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "Team name" })
      ).toHaveValue("Design");
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.getByRole("radio", { name: "Just me", exact: true }).check();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Everything look right?" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Finish example" }).click();
      await expect(
        page.getByRole("heading", { name: "All set." })
      ).toBeVisible();
      expect(
        JSON.parse((await page.getByTestId("payload").textContent())!).answers
      ).toHaveLength(2);
      const demoURL = new URL("./", page.url()).href;
      await page.getByRole("link", { name: "forms." }).click();
      await expect(page).toHaveURL(demoURL);
      await expect(
        page.getByRole("button", { name: "Start example" })
      ).toBeVisible();
      expect(errors).toEqual([]);
    });

    test(`${integration} / ${provider}: Enter submits the current step on a mobile viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("./");
      await expect(
        page.getByRole("combobox", { name: "React integration" })
      ).toBeVisible();
      await page
        .getByRole("combobox", { name: "React integration" })
        .selectOption({ label: integration });
      await page
        .getByRole("combobox", { name: "Schema provider" })
        .selectOption({ label: provider });
      await page.getByRole("button", { name: "Start example" }).click();
      await page.getByRole("textbox", { name: "Your name" }).fill("Jamie");
      await page.getByRole("textbox", { name: "Your name" }).press("Enter");
      await expect(
        page.getByRole("heading", { name: "Who are you planning for?" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("button", { name: "Finish example" }).click();
      await expect(
        page.getByRole("heading", { name: "All set." })
      ).toBeVisible();
    });
  }
}
