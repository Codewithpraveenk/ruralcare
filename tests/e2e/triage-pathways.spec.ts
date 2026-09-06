import { expect, test, type Page } from "@playwright/test";

async function registerPatient(page: Page, label: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.getByLabel("Patient name").fill(label);
  await page.getByLabel("Email").fill(`${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}@test.local`);
  await page.getByLabel("Password", { exact: true }).fill("BrowserTest@2026");
  await page.getByLabel("Confirm password").fill("BrowserTest@2026");
  await page.getByRole("button", { name: /Create patient account/i }).click();
  await page.getByRole("button", { name: /^Get care$/i }).click();
}

async function submitNeed(page: Page, need: string) {
  await page.getByPlaceholder(/Example: I am pregnant/i).fill(need);
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await expect(page.getByRole("heading", { name: /Here is what we understood/i })).toBeVisible();
  await page.getByRole("button", { name: /Confirm understanding/i }).click();
}

async function setMadurantakamPrimaryCareCapacity(page: Page, availability: "AVAILABLE" | "UNAVAILABLE") {
  await page.goto("/");
  await page.getByRole("button", { name: /Staff.*Facility Admin/i }).click();
  await page.getByRole("button", { name: /Use prototype staff account/i }).click();
  await expect(page.getByRole("heading", { name: /Today’s care pathways/i })).toBeVisible();
  const response = await page.request.put(
    "/api/capacity/government-hospital-madurantakam/PRIMARY_CARE",
    { data: { availability, verificationNote: "Browser pathway test", validForHours: 1 } },
  );
  expect(response.ok()).toBeTruthy();
  await page.getByRole("button", { name: /Logout/i }).click();
}

test("stable mild child fever remains routine when relevant negatives are supplied", async ({ page }) => {
  await registerPatient(page, "Routine Pathway");
  await submitNeed(
    page,
    "My 8-year-old child has mild fever since this morning. The child is drinking well, awake, has no vomiting, no seizure, no breathing difficulty and no stiff neck.",
  );
  await expect(page.getByText("ROUTINE", { exact: true })).toBeVisible();
  await expect(page.getByText("URGENT", { exact: true })).toHaveCount(0);
});

test("mild child fever without safety detail asks for information instead of becoming urgent", async ({ page }) => {
  await registerPatient(page, "Clarification Pathway");
  await submitNeed(page, "My child has mild fever since this morning.");
  await expect(page.getByText("INSUFFICIENT_INFORMATION", { exact: true })).toBeVisible();
  await expect(page.getByText(/One safety question|Safety details needed/i)).toBeVisible();
  await expect(page.getByText("URGENT", { exact: true })).toHaveCount(0);
});

test("breathing danger sign triggers the deterministic emergency pathway", async ({ page }) => {
  await registerPatient(page, "Emergency Pathway");
  await submitNeed(page, "I have severe difficulty breathing and cannot speak full sentences.");
  await expect(page.getByText("EMERGENCY", { exact: true })).toBeVisible();
  await expect(page.getByText("EMR_BREATHING_DIFFICULTY", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Show emergency destination/i })).toBeVisible();
});

test("contradictory safety statements block confirmation", async ({ page }) => {
  await registerPatient(page, "Contradiction Pathway");
  await page.getByPlaceholder(/Example: I am pregnant/i).fill(
    "I have difficulty breathing but I also have no breathing difficulty.",
  );
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await expect(page.getByRole("alert")).toContainText("Conflicting information needs correction");
  await expect(page.getByRole("button", { name: /Confirm understanding/i })).toBeDisabled();
});

test("routine pathway reroutes around unavailable capacity and creates a QR continuity pass", async ({ page }) => {
  await setMadurantakamPrimaryCareCapacity(page, "UNAVAILABLE");
  await registerPatient(page, "Reroute Continuity");
  await submitNeed(
    page,
    "I am an adult with a mild headache since this morning. I am awake and have no breathing difficulty, no confusion and no severe bleeding.",
  );
  await expect(page.getByText("ROUTINE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /See required public service/i }).click();
  await page.getByRole("button", { name: /Compare public facilities/i }).click();
  await expect(page.getByRole("heading", { name: /public-care options/i })).toBeVisible();
  await page.getByRole("button", { name: /See reroute/i }).first().click();
  await expect(page.getByRole("heading", { name: /cannot serve the need right now/i })).toBeVisible();
  await page.getByRole("button", { name: /Use this pathway/i }).click();
  await expect(page.getByRole("heading", { name: /^Why .* is suitable/i })).toBeVisible();
  await page.getByRole("button", { name: /Create continuity pass/i }).click();
  await expect(page.getByRole("heading", { name: /Carry the correct pathway forward/i })).toBeVisible();
  await page.getByRole("button", { name: /Create continuity pass/i }).click();
  await expect(page.getByRole("heading", { name: /public-care pathway continues/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /Referral handover QR code/i })).toBeVisible();
  await expect(page.getByText(/DIGITAL REFERRAL PASS/i)).toBeVisible();
  const referralId = (await page.locator(".digital-referral-pass code").textContent())?.trim();
  const referralLabel = (await page.locator(".digital-referral-pass h2").textContent())?.trim();
  expect(referralId).toBeTruthy();
  expect(referralLabel).toBeTruthy();

  await page.getByRole("button", { name: /Logout/i }).click();
  await page.getByRole("button", { name: /^Doctor/i }).click();
  await page.getByRole("button", { name: /Use prototype doctor account/i }).click();
  await page.getByRole("button", { name: /Scan pass/i }).click();
  await page.getByLabel("Referral pass code").fill(referralId!);
  await page.getByRole("button", { name: /Verify and open/i }).click();
  await expect(page.getByText(/do not have access to this referral/i)).toBeVisible();
  await expect(page.getByRole("dialog", { name: /Doctor referral review/i })).toHaveCount(0);
});

test("assigned-facility QR handover reaches doctor arrival and bilingual outcome", async ({ page }) => {
  await setMadurantakamPrimaryCareCapacity(page, "AVAILABLE");
  await registerPatient(page, "Doctor Handover");
  await submitNeed(
    page,
    "I am an adult with a mild headache since this morning. I am awake and have no breathing difficulty, no confusion and no severe bleeding.",
  );
  await page.getByRole("button", { name: /See required public service/i }).click();
  await page.getByRole("button", { name: /Compare public facilities/i }).click();
  const assignedFacility = page.locator(".facility-card").filter({ hasText: "Government Hospital, Madurantakam" });
  await expect(assignedFacility).toBeVisible();
  await assignedFacility.getByRole("button", { name: /Explain recommendation/i }).click();
  await page.getByRole("button", { name: /Create continuity pass/i }).click();
  await page.getByRole("button", { name: /Create continuity pass/i }).click();
  await expect(page.getByRole("img", { name: /Referral handover QR code/i })).toBeVisible();
  const referralId = (await page.locator(".digital-referral-pass code").textContent())!.trim();
  const referralLabel = (await page.locator(".digital-referral-pass h2").textContent())!.trim();

  await page.getByRole("button", { name: /Logout/i }).click();
  await page.getByRole("button", { name: /^Doctor/i }).click();
  await page.getByRole("button", { name: /Use prototype doctor account/i }).click();
  await page.getByRole("button", { name: /Scan pass/i }).click();
  await page.getByLabel("Referral pass code").fill(referralId);
  await page.getByRole("button", { name: /Verify and open/i }).click();
  await expect(page.getByRole("dialog", { name: /Doctor referral review/i })).toContainText(referralLabel);
  await page.getByRole("button", { name: "×" }).click();
  await page.getByRole("button", { name: /^Referrals$/i }).click();

  let referralCard = page.locator(".doctor-case-list article").filter({ hasText: referralLabel });
  await expect(referralCard).toBeVisible();
  await referralCard.getByRole("button", { name: /Accept hand-off/i }).click();
  referralCard = page.locator(".doctor-case-list article").filter({ hasText: referralLabel });
  await referralCard.getByRole("button", { name: /Mark arrived/i }).click();
  referralCard = page.locator(".doctor-case-list article").filter({ hasText: referralLabel });
  await referralCard.getByRole("button", { name: /Review hand-off/i }).click();
  const review = page.getByRole("dialog", { name: /Doctor referral review/i });
  await review.getByLabel(/Patient instruction — English/i).fill("Return for review if symptoms worsen.");
  await review.getByLabel(/நோயாளி வழிமுறை — தமிழ்/i).fill("அறிகுறிகள் மோசமானால் மீண்டும் பரிசோதனைக்கு வரவும்.");
  await review.getByRole("button", { name: /Save and share with patient/i }).click();
  await expect(page.getByText(/Visit outcome saved and shared/i)).toBeVisible();
});
