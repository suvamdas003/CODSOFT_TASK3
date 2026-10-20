#!/usr/bin/env node
/**
 * Smoke test for a running deployment (e.g. `docker compose up -d` + demo seed).
 * Signs in as each demo role and exercises core workflows in headless Chromium.
 *
 *   node scripts/docker-smoke.mjs [baseUrl]      # default http://localhost:8088
 *
 * Requires the demo seed and `npx playwright install chromium`. It modifies demo
 * data (applies to a job, moves an applicant), so never point it at production.
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:8088";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
}

const browser = await chromium.launch();
try {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  check("health endpoint reports database + storage ok", health.status === "ok", JSON.stringify(health.checks));

  // Candidate
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "candidate@careerhub.test", "DevOnly-Candidate-2026!");
    check("candidate login lands on dashboard", page.url().endsWith("/candidate"), page.url());
    const cookie = (await ctx.cookies()).find((c) => c.name === "ch_session");
    check("session cookie is HttpOnly, Secure, SameSite=Lax", Boolean(cookie?.httpOnly && cookie?.secure && cookie?.sameSite === "Lax"));

    await page.goto(`${BASE}/jobs?q=intern`);
    await page.getByRole("link", { name: "Engineering Intern" }).click();
    await page.getByRole("button", { name: "Submit application" }).click();
    await page.getByText("Application submitted!").waitFor();
    check("candidate can apply to a job", true);

    await page.goto(`${BASE}/candidate/resumes`);
    const href = await page.getByRole("link", { name: "Download" }).first().getAttribute("href");
    const res = await page.request.get(`${BASE}${href}`);
    const body = await res.body();
    check("resume download served from the uploads volume", res.status() === 200 && body.subarray(0, 5).toString() === "%PDF-", `status ${res.status()}`);
    const anon = await fetch(`${BASE}${href}`);
    check("anonymous resume download is rejected", anon.status === 401, `status ${anon.status}`);

    await page.goto(`${BASE}/admin`);
    await page.waitForURL("**/forbidden", { timeout: 10_000 }).catch(() => undefined);
    check("candidate is denied the admin area", page.url().endsWith("/forbidden"), page.url());
    await ctx.close();
  }

  // Recruiter
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "recruiter@careerhub.test", "DevOnly-Recruiter-2026!");
    await page.getByRole("heading", { name: "Recruitment overview" }).waitFor();
    const stats = await page.getByText("Job performance").waitFor({ timeout: 10_000 }).then(() => true, () => false);
    check("recruiter login shows live statistics", stats);
    await page.goto(`${BASE}/recruiter/applicants?q=Ava`);
    await page.getByRole("link", { name: "Ava Candidate" }).first().click();
    await page.getByLabel("Move to stage").selectOption("SHORTLISTED");
    await page.getByRole("button", { name: "Update status" }).click();
    await page.getByText("Status updated.").waitFor();
    check("recruiter can move an applicant through the pipeline", true);
    await ctx.close();
  }

  // Administrator
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "admin@careerhub.test", "DevOnly-Admin-2026!");
    await page.getByRole("heading", { name: "Platform overview" }).waitFor();
    await page.goto(`${BASE}/admin/reports?status=OPEN`);
    const report = await page.getByText("Fraud or scam").first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
    check("admin sees the open fraud report", report);
    await page.goto(`${BASE}/admin/audit`);
    const audit = await page.getByRole("heading", { name: "Audit log" }).waitFor({ timeout: 10_000 }).then(() => true, () => false);
    check("admin can open the audit log", audit);
    await ctx.close();
  }
} catch (error) {
  check("smoke test completed without errors", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
