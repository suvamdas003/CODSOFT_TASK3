import { ValidationError } from "@/lib/errors";

export const RESUME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type ResumeExtension = keyof typeof RESUME_TYPES;

export const RESUME_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Validates an uploaded resume by extension AND file signature ("magic bytes"),
 * never trusting the client-supplied MIME type. Only PDF and DOCX are accepted;
 * macro-enabled Office files, scripts and executables are rejected.
 */
export function inspectResumeFile(fileName: string, data: Buffer, maxBytes: number): { extension: ResumeExtension; mimeType: string; safeName: string } {
  if (data.length === 0) throw new ValidationError("The file is empty.", { file: "The file is empty." });
  if (data.length > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(maxBytes % (1024 * 1024) ? 1 : 0);
    throw new ValidationError(`Files must be ${mb} MB or smaller.`, { file: `Files must be ${mb} MB or smaller.` });
  }

  const safeName = sanitizeFileName(fileName);
  const extension = safeName.split(".").pop()?.toLowerCase();
  const invalid = () => new ValidationError("Only PDF and Word (.docx) files are accepted.", { file: "Only PDF and Word (.docx) files are accepted." });

  if (extension === "pdf") {
    // The PDF header must appear within the first 1024 bytes.
    if (!data.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw invalid();
    const text = data.toString("latin1");
    if (/\/(JavaScript|Launch)\b/.test(text)) {
      throw new ValidationError("PDFs with embedded scripts or launch actions are not allowed.", { file: "PDFs with embedded scripts are not allowed." });
    }
    return { extension, mimeType: RESUME_TYPES.pdf, safeName };
  }

  if (extension === "docx") {
    // DOCX is a ZIP container: local file header signature + Word parts.
    const isZip = data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
    if (!isZip || !data.includes(Buffer.from("[Content_Types].xml")) || !data.includes(Buffer.from("word/"))) throw invalid();
    if (data.includes(Buffer.from("vbaProject.bin"))) {
      throw new ValidationError("Macro-enabled documents are not allowed.", { file: "Macro-enabled documents are not allowed." });
    }
    return { extension, mimeType: RESUME_TYPES.docx, safeName };
  }

  throw invalid();
}

/** Strips any path, control and unsafe characters from a client-provided file name. */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001F\u007F<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned) return "resume";
  if (cleaned.length <= 200) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 200 - ext.length) + ext;
}

/** Content-Disposition header value that is safe for any file name (RFC 6266 / 5987). */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
