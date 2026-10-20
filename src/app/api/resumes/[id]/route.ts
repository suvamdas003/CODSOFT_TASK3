import { NextResponse, type NextRequest } from "next/server";
import { contentDisposition } from "@/features/candidates/resume-file";
import { getResumeForDownload } from "@/features/candidates/service";
import { AppError } from "@/lib/errors";
import { idField } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";

/**
 * Authorised resume download. Files are never publicly addressable: every
 * request is checked against the session (owner, or recruiter of a job the
 * resume was submitted to) and served as an attachment that browsers will not
 * render inline or sniff.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idField.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const { resume, data } = await getResumeForDownload(user, id);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": resume.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": contentDisposition(resume.originalName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[resume download] failed", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
