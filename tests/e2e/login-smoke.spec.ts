import { expect, test } from "@playwright/test";

test("login page renders required fields", async ({ page }) => {
  await page.goto("/Inspection/login/");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByPlaceholder("Enter user name")).toBeVisible();
  await expect(page.getByPlaceholder("Enter password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
