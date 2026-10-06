import { expect, test } from "@playwright/test";

for (const integration of ["tanstack", "atom"]) {
  test.describe(integration, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`./tests/async.html?integration=${integration}`);
    });

    test("editing during validation discards the stale result", async ({
      page,
    }) => {
      await page
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Alex");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("status")).toHaveText("Pending");
      await page.getByRole("textbox", { name: "Name", exact: true }).fill("");
      await expect(page.getByRole("status")).toHaveText("Idle");
      await expect(page.getByRole("heading")).toHaveText("Name");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("alert")).toHaveText(
        "At least three characters."
      );
    });

    test("rejected validators display an error and allow a retry", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("crash");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("alert")).toContainText("could not validate");
      await expect(page.getByRole("heading")).toHaveText("Name");
      await page
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Alex");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading")).toHaveText("Review");
      expect(errors).toEqual([]);
    });

    test("double clicks cannot advance twice or submit twice", async ({
      page,
    }) => {
      await page
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Alex");
      await page.getByRole("button", { name: "Continue" }).dblclick();
      await expect(page.getByRole("heading")).toHaveText("Review");
      await expect(page.getByTestId("submissions")).toHaveText("0");
      await page
        .getByRole("button", { name: "Submit", exact: true })
        .dblclick();
      await expect(page.getByTestId("status")).toHaveText("submitted");
      await expect(page.getByTestId("submissions")).toHaveText("1");
    });

    test("back navigation cancels a pending submission validation", async ({
      page,
    }) => {
      await page
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Alex");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading")).toHaveText("Review");
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("Pending");
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("Idle");
      await expect(page.getByRole("heading")).toHaveText("Name");
      await expect(page.getByTestId("submissions")).toHaveText("0");
    });

    test("back navigation cannot discard a completed transport request", async ({
      page,
    }) => {
      await page.goto(
        `./tests/async.html?integration=${integration}&transport=manual`
      );
      await page
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Alex");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading")).toHaveText("Review");
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await expect(page.getByTestId("status")).toHaveText("submitting");
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(page.getByRole("heading")).toHaveText("Name");
      await page.getByRole("button", { name: "Finish request" }).click();
      await expect(page.getByRole("status")).toHaveText("Idle");
      await expect(page.getByTestId("status")).toHaveText("submitted");
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await expect(page.getByTestId("submissions")).toHaveText("1");
    });
  });
}

test("Effect Atom shares live values with external atom consumers", async ({
  page,
}) => {
  await page.goto("./tests/async.html?integration=atom");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Alex");
  await expect(
    page.getByRole("textbox", { name: "Shared atom name" })
  ).toHaveValue("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("status")).toHaveText("Pending");
  await page.getByRole("textbox", { name: "Shared atom name" }).fill("Ada");
  await expect(page.getByRole("status")).toHaveText("Idle");
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true })
  ).toHaveValue("Ada");
  await expect(page.getByRole("heading")).toHaveText("Name");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading")).toHaveText("Review");
});
