import { describe, expect, it } from "vitest";
import { registerSchema, changePasswordSchema } from "@/features/auth/schemas";
import { jobInputSchema } from "@/features/jobs/schemas";
import { candidateProfileSchema } from "@/features/candidates/schemas";
import { interviewSchema } from "@/features/applications/schemas";
import { moderateJobSchema } from "@/features/admin/schemas";
import { ValidationError } from "@/lib/errors";
import { formatSalary, label } from "@/lib/format";
import { buildQuery, parsePage, skillKeysOf } from "@/lib/utils";
import { parseInput } from "@/lib/validation";
import { validateServerEnv } from "@/lib/env";

const validJob = {
  title: "Backend Engineer",
  location: "Remote",
  workplaceType: "REMOTE",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  description: "A sufficiently long description of the role.",
  requirements: "Node.js and SQL experience.",
  salaryMin: "50000",
  salaryMax: "70000",
  salaryCurrency: "eur",
  skills: "Node.js, SQL, node.js, , Docker",
};

describe("registration validation", () => {
  it("normalises email and never allows ADMIN self-registration", () => {
    const ok = parseInput(registerSchema, { role: "CANDIDATE", name: "Ada", email: "  Ada@Example.TEST ", password: "abcdefgh12" });
    expect(ok.email).toBe("ada@example.test");
    expect(() => parseInput(registerSchema, { role: "ADMIN", name: "Eve", email: "eve@example.test", password: "abcdefgh12" })).toThrow(ValidationError);
  });

  it("requires strong-enough passwords and a company for recruiters", () => {
    try {
      parseInput(registerSchema, { role: "RECRUITER", name: "Rae", email: "rae@example.test", password: "short" });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const fields = (error as ValidationError).fieldErrors!;
      expect(fields.password).toMatch(/at least 10/);
      expect(fields.companyName).toBeDefined();
    }
  });

  it("checks password confirmation", () => {
    expect(() => parseInput(changePasswordSchema, { currentPassword: "x", newPassword: "abcdefgh12", confirmPassword: "abcdefgh13" })).toThrow(ValidationError);
  });
});

describe("job validation", () => {
  it("parses numbers, currency and de-duplicates skills", () => {
    const job = parseInput(jobInputSchema, validJob);
    expect(job.salaryMin).toBe(50000);
    expect(job.salaryCurrency).toBe("EUR");
    expect(job.skills).toEqual(["Node.js", "SQL", "Docker"]);
    expect(job.applicationDeadline).toBeNull();
  });

  it("rejects inverted salary ranges and unknown enum values", () => {
    expect(() => parseInput(jobInputSchema, { ...validJob, salaryMin: "90000" })).toThrow(ValidationError);
    expect(() => parseInput(jobInputSchema, { ...validJob, employmentType: "SLAVERY" })).toThrow(ValidationError);
  });

  it("rejects control characters (e.g. injected NUL bytes)", () => {
    expect(() => parseInput(jobInputSchema, { ...validJob, title: "Engineer\u0000" })).toThrow(ValidationError);
  });
});

describe("profile validation", () => {
  it("only allows http(s) URLs (no javascript: links)", () => {
    expect(() => parseInput(candidateProfileSchema, { linkedinUrl: "javascript:alert(1)" })).toThrow(ValidationError);
    const ok = parseInput(candidateProfileSchema, { linkedinUrl: "https://linkedin.example/in/me", openToWork: "on", experienceYears: "4" });
    expect(ok).toMatchObject({ linkedinUrl: "https://linkedin.example/in/me", openToWork: true, experienceYears: 4, headline: null });
  });
});

describe("interview and moderation validation", () => {
  it("rejects interviews in the past", () => {
    expect(() =>
      parseInput(interviewSchema, { applicationId: "abc123", startsAt: "2020-01-01T10:00", durationMinutes: "30", mode: "VIDEO" }),
    ).toThrow(ValidationError);
  });

  it("requires a reason to remove a listing", () => {
    expect(() => parseInput(moderateJobSchema, { jobId: "abc123", decision: "REMOVE" })).toThrow(ValidationError);
    expect(parseInput(moderateJobSchema, { jobId: "abc123", decision: "RESTORE" }).decision).toBe("RESTORE");
  });
});

describe("formatting and helpers", () => {
  it("formats salaries and labels", () => {
    expect(formatSalary(50000, 70000, "USD")).toBe("$50,000 – $70,000");
    expect(formatSalary(null, null, "USD")).toBeNull();
    expect(formatSalary(1000, null, "EUR")).toBe("From €1,000");
    expect(label("FULL_TIME")).toBe("Full-time");
  });

  it("parses pages, builds queries and normalises skills", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(buildQuery({ q: "react", page: undefined, status: "" })).toBe("?q=react");
    expect(skillKeysOf(["React", "react ", "SQL"])).toEqual(["react", "sql"]);
  });

  it("validates server configuration", () => {
    expect(validateServerEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toContain("DATABASE_URL is required.");
    expect(validateServerEnv({ NODE_ENV: "production", DATABASE_URL: "x", STORAGE_DRIVER: "s3" } as NodeJS.ProcessEnv).length).toBe(4);
    expect(validateServerEnv({ NODE_ENV: "production", DATABASE_URL: "x" } as NodeJS.ProcessEnv)).toEqual([]);
  });
});
