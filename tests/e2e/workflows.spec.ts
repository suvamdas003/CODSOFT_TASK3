import { expect, test, type Page } from "@playwright/test";

// Development-only demo accounts created by prisma/seed.ts.
const ACCOUNTS = {
  admin: { email: "admin@careerhub.test", password: "DevOnly-Admin-2026!" },
  recruiter: { email: "recruiter@careerhub.test", password: "DevOnly-Recruiter-2026!" },
  recruiter2: { email: "recruiter2@careerhub.test", password: "DevOnly-Recruiter-2026!" },
  candidate: { email: "candidate@careerhub.test", password: "DevOnly-Candidate-2026!" },
  candidate3: { email: "candidate3@careerhub.test", password: "DevOnly-Candidate-2026!" },
};

async function login(page: Page, who: keyof typeof ACCOUNTS, next?: string) {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(ACCOUNTS[who].email);
  await page.getByLabel("Password").fill(ACCOUNTS[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function logout(page: Page) {
  await page.locator("summary").filter({ hasText: "Open account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1");

test.describe("access control", () => {
  test("protected pages redirect anonymous visitors to sign in", async ({ page }) => {
    await page.goto("/candidate/applications");
    await expect(page).toHaveURL(/\/login\?next=%2Fcandidate%2Fapplications/);
    const health = await page.request.get("/api/health");
    expect(await health.json()).toMatchObject({ status: "ok", checks: { database: "ok", storage: "ok" } });
  });

  test("wrong password shows an error and keeps the email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ACCOUNTS.candidate.email);
    await page.getByLabel("Password").fill("Not-The-Password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("main [role=alert]")).toHaveText("Invalid email or password.");
    await expect(page.getByLabel("Email")).toHaveValue(ACCOUNTS.candidate.email);
  });

  test("candidates cannot open admin or recruiter areas", async ({ page }) => {
    await login(page, "candidate");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/forbidden$/);
    await page.goto("/recruiter/jobs");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});

test.describe("candidate workflow", () => {
  test("search, apply once, upload and download a resume", async ({ page }) => {
    await login(page, "candidate", "/jobs");

    await page.getByLabel("Keyword").fill("advocate");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText("1 open position")).toBeVisible();
    await page.getByRole("link", { name: "Developer Advocate" }).click();

    await expect(page.getByRole("heading", { name: "Developer Advocate" })).toBeVisible();
    await page.getByLabel("Cover letter").fill("I enjoy writing guides for developers.");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Application submitted!")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status history" })).toBeVisible();

    // Duplicate prevention: the job page now links to the existing application.
    await page.getByRole("link", { name: "View job posting" }).click();
    await expect(page.getByText("You applied to this job.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit application" })).toHaveCount(0);

    // Resume upload (validation + success) and authorised download.
    await page.goto("/candidate/resumes");
    const fileInput = page.locator('form:has(button:text("Upload resume")) input[type=file]');
    await fileInput.setInputFiles({ name: "tool.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
    await page.getByRole("button", { name: "Upload resume" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Only PDF and Word");

    await fileInput.setInputFiles({ name: "E2E Resume.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: "Upload resume" }).click();
    await expect(page.getByText("Resume uploaded.")).toBeVisible();
    await expect(page.getByText("E2E Resume.pdf")).toBeVisible();

    const row = page.locator("li", { hasText: "E2E Resume.pdf" });
    const href = await row.getByRole("link", { name: "Download" }).getAttribute("href");
    const download = await page.request.get(href!);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toBe("application/pdf");
    expect(download.headers()["content-disposition"]).toContain("attachment");
    expect((await download.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Another candidate cannot download it; anonymous requests are rejected.
    await logout(page);
    expect((await page.request.get(href!)).status()).toBe(401);
    await login(page, "candidate3");
    expect((await page.request.get(href!)).status()).toBe(404);
  });

  test("saving a job shows it under saved jobs", async ({ page }) => {
    await login(page, "candidate3", "/jobs?q=intern");
    const card = page.locator("article", { hasText: "Engineering Intern" });
    await card.getByRole("button", { name: /Save/ }).click();
    await expect(card.getByRole("button", { name: /Saved/ })).toBeVisible();
    await page.goto("/candidate/saved");
    await expect(page.getByRole("link", { name: "Engineering Intern" })).toBeVisible();
  });
});

test.describe("recruiter workflow", () => {
  test("publish a job, then manage an applicant through the pipeline", async ({ page }) => {
    await login(page, "recruiter");
    await expect(page.getByRole("heading", { name: "Recruitment overview" })).toBeVisible();

    // Validation errors keep what was typed.
    await page.goto("/recruiter/jobs/new");
    await page.getByLabel("Job title").fill("E2E Platform Engineer");
    await page.getByLabel("Location").fill("Remote");
    // Passes the browser's `required` check but fails server-side length validation.
    await page.getByLabel("About the role").fill("Too short");
    await page.getByLabel("Requirements").fill("Too short");
    await page.getByRole("button", { name: "Publish job" }).click();
    await expect(page.locator("main [role=alert]").first()).toContainText("Please correct");
    await expect(page.getByText("Description must be at least 20 characters.")).toBeVisible();
    await expect(page.getByLabel("Job title")).toHaveValue("E2E Platform Engineer");

    await page.getByLabel("About the role").fill("Own our cloud platform and developer experience end to end.");
    await page.getByLabel("Requirements").fill("Kubernetes, Terraform and a calm on-call attitude.");
    await page.getByLabel("Skills").fill("Kubernetes, Terraform");
    await page.getByRole("button", { name: "Publish job" }).click();
    await expect(page.getByText("Job published.")).toBeVisible();

    const publicSearch = await page.request.get("/jobs?q=E2E%20Platform");
    expect(await publicSearch.text()).toContain("E2E Platform Engineer");

    // Seeded applicant Ava (Senior Frontend Engineer).
    await page.goto("/recruiter/applicants?q=Ava");
    await page.getByRole("link", { name: "Ava Candidate" }).first().click();
    await expect(page.getByRole("heading", { name: "Ava Candidate" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download resume" })).toBeVisible();

    await page.getByLabel("Move to stage").selectOption("OFFERED");
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText("Status updated.")).toBeVisible();

    await page.getByLabel("Add an internal note").fill("E2E note: strong offer candidate");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("E2E note: strong offer candidate")).toBeVisible();

    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16);
    await page.getByLabel("Date & time (UTC)").fill(nextWeek);
    await page.getByLabel("Link, phone or address").fill("https://meet.example/e2e");
    await page.getByRole("button", { name: "Schedule interview" }).click();
    await expect(page.getByText("Interview scheduled.")).toBeVisible();

    // Another recruiter cannot open this application.
    const applicationUrl = page.url();
    await logout(page);
    await login(page, "recruiter2");
    await page.goto(applicationUrl);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("Ava Candidate")).toHaveCount(0);
    await expect(page.getByText("E2E note: strong offer candidate")).toHaveCount(0);
  });
});

test.describe("administrator workflow", () => {
  test("resolve a fraud report by removing the listing, and review the audit log", async ({ page }) => {
    await login(page, "admin");
    await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();

    await page.goto("/admin/reports?status=OPEN");
    const report = page.locator("li", { hasText: "Fraud or scam" });
    await report.getByLabel("Also remove the listing").check();
    await report.getByRole("button", { name: "Resolve" }).click();
    // The resolved report leaves the "Open" list.
    await expect(page.locator("li", { hasText: "Fraud or scam" })).toHaveCount(0);

    await page.goto("/jobs?q=from%20home");
    await expect(page.getByText("0 open positions")).toBeVisible();

    await page.goto("/admin/audit?action=job.");
    await expect(page.getByText("job.remove")).toBeVisible();

    await page.goto("/admin/users?q=candidate3");
    await page.getByRole("button", { name: "Suspend" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Confirm suspension" }).click();
    // The row switches to the suspended state.
    await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();
    await expect(page.locator("tbody").getByText("Suspended")).toBeVisible();
  });
});
