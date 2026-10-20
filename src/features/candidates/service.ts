import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getStorage } from "@/server/storage";
import { getPlatformSettings } from "@/server/settings";
import { config } from "@/lib/env";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { skillKeysOf } from "@/lib/utils";
import type { CandidateProfileInput } from "./schemas";
import { inspectResumeFile } from "./resume-file";

function assertCandidate(actor: Actor) {
  if (actor.role !== "CANDIDATE") throw new ForbiddenError("Only candidates have resumes and candidate profiles.");
}

// ─── Profile ────────────────────────────────────────────────────────────────

export async function getCandidateProfile(actor: Actor) {
  assertCandidate(actor);
  return prisma.candidateProfile.upsert({ where: { userId: actor.id }, update: {}, create: { userId: actor.id } });
}

export async function updateCandidateProfile(actor: Actor, input: CandidateProfileInput) {
  assertCandidate(actor);
  const data = { ...input, skillKeys: skillKeysOf(input.skills) };
  await prisma.candidateProfile.upsert({ where: { userId: actor.id }, update: data, create: { userId: actor.id, ...data } });
}

// ─── Resumes ────────────────────────────────────────────────────────────────

const resumeSelect = { id: true, originalName: true, mimeType: true, sizeBytes: true, isDefault: true, createdAt: true, updatedAt: true } as const;

export async function listResumes(actor: Actor) {
  assertCandidate(actor);
  return prisma.resume.findMany({ where: { ownerId: actor.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], select: resumeSelect });
}

export type UploadedFile = { name: string; data: Buffer };

function storageKeyFor(ownerId: string, extension: string) {
  return `resumes/${ownerId}/${randomUUID()}.${extension}`;
}

/** Validates and stores a new resume. The first resume becomes the default. */
export async function uploadResume(actor: Actor, file: UploadedFile) {
  assertCandidate(actor);
  const { extension, mimeType, safeName } = inspectResumeFile(file.name, file.data, config.resumeMaxBytes);
  const settings = await getPlatformSettings();
  const existing = await prisma.resume.count({ where: { ownerId: actor.id } });
  if (existing >= settings.maxResumesPerCandidate) {
    throw new ValidationError(`You can keep at most ${settings.maxResumesPerCandidate} resumes. Delete or replace one first.`);
  }

  const storageKey = storageKeyFor(actor.id, extension);
  await getStorage().put(storageKey, file.data, mimeType);
  try {
    return await prisma.resume.create({
      data: {
        ownerId: actor.id,
        originalName: safeName,
        storageKey,
        mimeType,
        sizeBytes: file.data.length,
        sha256: createHash("sha256").update(file.data).digest("hex"),
        isDefault: existing === 0,
      },
      select: resumeSelect,
    });
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

/** Replaces the file of an existing resume, keeping its id (and application links). */
export async function replaceResume(actor: Actor, resumeId: string, file: UploadedFile) {
  assertCandidate(actor);
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, ownerId: actor.id } });
  if (!resume) throw new NotFoundError("Resume not found.");
  const { extension, mimeType, safeName } = inspectResumeFile(file.name, file.data, config.resumeMaxBytes);

  const storageKey = storageKeyFor(actor.id, extension);
  await getStorage().put(storageKey, file.data, mimeType);
  try {
    await prisma.resume.update({
      where: { id: resume.id },
      data: {
        originalName: safeName,
        storageKey,
        mimeType,
        sizeBytes: file.data.length,
        sha256: createHash("sha256").update(file.data).digest("hex"),
      },
    });
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
  await getStorage().delete(resume.storageKey).catch((err) => console.error("[resume] failed to delete old file", err));
}

export async function setDefaultResume(actor: Actor, resumeId: string) {
  assertCandidate(actor);
  const owns = await prisma.resume.count({ where: { id: resumeId, ownerId: actor.id } });
  if (!owns) throw new NotFoundError("Resume not found.");
  await prisma.$transaction([
    prisma.resume.updateMany({ where: { ownerId: actor.id, isDefault: true }, data: { isDefault: false } }),
    prisma.resume.update({ where: { id: resumeId }, data: { isDefault: true } }),
  ]);
}

/**
 * Deletes a resume file and its metadata. Applications that referenced it keep
 * existing but lose access to the file (resume_id is set to NULL).
 */
export async function deleteResume(actor: Actor, resumeId: string) {
  assertCandidate(actor);
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, ownerId: actor.id } });
  if (!resume) throw new NotFoundError("Resume not found.");
  await prisma.$transaction(async (tx) => {
    await tx.resume.delete({ where: { id: resume.id } });
    if (resume.isDefault) {
      const next = await tx.resume.findFirst({ where: { ownerId: actor.id }, orderBy: { createdAt: "desc" } });
      if (next) await tx.resume.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  await getStorage().delete(resume.storageKey).catch((err) => console.error("[resume] failed to delete file", err));
}

/**
 * Authorises a resume download:
 *  - the candidate who owns it, or
 *  - a recruiter who owns a job the resume was submitted to (and the
 *    application has not been withdrawn).
 * Administrators are deliberately not granted access to candidate files.
 */
export async function getResumeForDownload(actor: Actor, resumeId: string) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new NotFoundError("Resume not found.");

  let allowed = resume.ownerId === actor.id;
  if (!allowed && actor.role === "RECRUITER") {
    allowed =
      (await prisma.application.count({
        where: { resumeId, status: { not: "WITHDRAWN" }, job: { postedById: actor.id } },
      })) > 0;
  }
  // Same response as "not found" so ids cannot be probed.
  if (!allowed) throw new NotFoundError("Resume not found.");

  const data = await getStorage().get(resume.storageKey);
  return { resume, data };
}
