import { expect, test } from "@playwright/test";

test("ASHA prototype login opens the follow-up workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /ASHA Worker/i }).click();
  await page.getByRole("button", { name: /Use prototype ASHA account/i }).click();
  await expect(page.getByRole("button", { name: /ASHA dashboard/i })).toBeVisible();
  await page.getByRole("button", { name: /ASHA dashboard/i }).click();
  await expect(page.getByRole("heading", { name: /People who may need help reaching care/i })).toBeVisible();
  await page.getByRole("button", { name: /Assisted intake/i }).click();
  await expect(page.getByRole("heading", { name: /How can we help/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /ASHA dashboard/i })).toBeVisible();
});

test("doctor and staff prototype accounts open the correct scoped dashboards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Doctor/i }).click();
  await page.getByRole("button", { name: /Use prototype doctor account/i }).click();
  await expect(page.getByRole("heading", { name: /Assigned care hand-offs/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Scan pass/i })).toBeVisible();
  await page.getByRole("button", { name: /Logout/i }).click();

  await page.getByRole("button", { name: /Staff.*Facility Admin/i }).click();
  await page.getByRole("button", { name: /Use prototype staff account/i }).click();
  await expect(page.getByRole("heading", { name: /Today’s care pathways/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Capacity$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Insights$/i })).toBeVisible();
});

test("new patient lands on a neutral care home instead of a restored safety result", async ({ page }) => {
  const email = `patient-${Date.now()}@test.local`;
  await page.goto("/");
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.getByLabel("Patient name").fill("Browser Test Patient");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("BrowserTest@2026");
  await page.getByLabel("Confirm password").fill("BrowserTest@2026");
  await page.getByRole("button", { name: /Create patient account/i }).click();
  await expect(page.getByRole("heading", { name: /Welcome, Browser/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Home$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Get care$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^My referrals$/i })).toBeVisible();
  await expect(page.getByText("EMERGENCY", { exact: true })).toHaveCount(0);
});
