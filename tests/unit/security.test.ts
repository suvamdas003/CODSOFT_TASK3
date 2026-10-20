import { describe, expect, it } from "vitest";
import { contentDisposition, inspectResumeFile, sanitizeFileName } from "@/features/candidates/resume-file";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { safeRedirectPath } from "@/lib/utils";
import { clientIpFromHeaders, isSameOriginRequest } from "@/server/request";
import { signRequest } from "@/server/storage/sigv4";
import { assertValidKey } from "@/server/storage/types";
import { ValidationError } from "@/lib/errors";

const MB = 1024 * 1024;
const pdf = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF", "latin1");
const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....[Content_Types].xml....word/document.xml....")]);

describe("resume file validation", () => {
  it("accepts real PDF and DOCX signatures", () => {
    expect(inspectResumeFile("cv.pdf", pdf, 5 * MB)).toMatchObject({ extension: "pdf", mimeType: "application/pdf" });
    expect(inspectResumeFile("CV.DOCX", docx, 5 * MB).extension).toBe("docx");
  });

  it("rejects files whose content does not match the extension", () => {
    expect(() => inspectResumeFile("cv.pdf", Buffer.from("MZ\x90\x00 executable"), 5 * MB)).toThrow(ValidationError);
    expect(() => inspectResumeFile("cv.docx", pdf, 5 * MB)).toThrow(ValidationError);
  });

  it("rejects executables, scripts and unsupported types", () => {
    for (const name of ["setup.exe", "script.js", "page.html", "macro.docm", "cv.doc", "noextension"]) {
      expect(() => inspectResumeFile(name, pdf, 5 * MB)).toThrow(ValidationError);
    }
  });

  it("rejects macro-enabled documents and PDFs with JavaScript", () => {
    const macro = Buffer.concat([docx, Buffer.from("word/vbaProject.bin")]);
    expect(() => inspectResumeFile("cv.docx", macro, 5 * MB)).toThrow(/Macro/);
    const scripted = Buffer.from("%PDF-1.4\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>", "latin1");
    expect(() => inspectResumeFile("cv.pdf", scripted, 5 * MB)).toThrow(/scripts/);
  });

  it("enforces size limits and rejects empty files", () => {
    expect(() => inspectResumeFile("cv.pdf", Buffer.alloc(0), 5 * MB)).toThrow(/empty/);
    const big = Buffer.concat([pdf, Buffer.alloc(5 * MB)]);
    expect(() => inspectResumeFile("cv.pdf", big, 5 * MB)).toThrow(/5 MB or smaller/);
  });

  it("sanitises file names (paths, control characters, leading dots)", () => {
    expect(sanitizeFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeFileName("C:\\Users\\me\\My CV.pdf")).toBe("My CV.pdf");
    expect(sanitizeFileName("..hidden\u0000<x>.pdf")).toBe("hiddenx.pdf");
    expect(sanitizeFileName("")).toBe("resume");
    const long = sanitizeFileName(`${"a".repeat(300)}.pdf`);
    expect(long.length).toBe(200);
    expect(long.endsWith(".pdf")).toBe(true);
  });

  it("builds header-safe Content-Disposition values", () => {
    const header = contentDisposition('Résumé "final".pdf');
    expect(header).toContain('filename="R_sum_ _final_.pdf"');
    expect(header).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9%20%22final%22.pdf");
    expect(header).not.toMatch(/[\r\n]/);
  });
});

describe("storage keys", () => {
  it("only accepts server-generated key shapes", () => {
    expect(() => assertValidKey("resumes/abc123/0b5e2a5e-1111-4222-8333-944455556666.pdf")).not.toThrow();
    for (const bad of ["../secret", "resumes/abc/../../x.pdf", "resumes/abc/file.exe", "/etc/passwd"]) {
      expect(() => assertValidKey(bad)).toThrow();
    }
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("Correct-Horse-9");
    const b = await hashPassword("Correct-Horse-9");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Correct-Horse-9", a)).toBe(true);
    expect(await verifyPassword("wrong-password-9", a)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});

describe("open-redirect protection", () => {
  it("only allows same-site relative paths", () => {
    expect(safeRedirectPath("/candidate/applications")).toBe("/candidate/applications");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", undefined, 42]) {
      expect(safeRedirectPath(bad, "/fallback")).toBe("/fallback");
    }
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window and resets afterwards", () => {
    const key = `test-${Math.random()}`;
    const t0 = 1_000_000;
    expect([1, 2, 3].map(() => rateLimit(key, 3, 1000, t0))).toEqual([true, true, true]);
    expect(rateLimit(key, 3, 1000, t0 + 10)).toBe(false);
    expect(rateLimit(key, 3, 1000, t0 + 1001)).toBe(true);
  });
});

describe("request helpers", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost:3005/api/x", { method: "POST", headers });

  it("accepts same-origin and rejects cross-site requests (CSRF)", () => {
    expect(isSameOriginRequest(req({ origin: "http://localhost:3005", host: "localhost:3005" }))).toBe(true);
    expect(isSameOriginRequest(req({ origin: "https://evil.example", host: "localhost:3005" }))).toBe(false);
    expect(isSameOriginRequest(req({ host: "localhost:3005", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(req({ host: "localhost:3005", "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("ignores X-Forwarded-For unless the proxy is trusted", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIpFromHeaders(h, false)).toBeNull();
    expect(clientIpFromHeaders(h, true)).toBe("203.0.113.9");
  });
});

describe("S3 SigV4 signing", () => {
  it("matches the AWS documented example (GET Object)", () => {
    const headers = signRequest({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      headers: { range: "bytes=0-9" },
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      date: new Date("2013-05-24T00:00:00Z"),
    });
    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(headers["x-amz-date"]).toBe("20130524T000000Z");
  });
});
