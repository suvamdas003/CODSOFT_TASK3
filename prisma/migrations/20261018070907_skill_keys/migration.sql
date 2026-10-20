-- AlterTable
ALTER TABLE "candidate_profiles" ADD COLUMN     "skill_keys" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "skill_keys" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "candidate_profiles_skill_keys_idx" ON "candidate_profiles" USING GIN ("skill_keys");

-- CreateIndex
CREATE INDEX "jobs_skill_keys_idx" ON "jobs" USING GIN ("skill_keys");

-- Backfill lower-cased skill keys for existing rows.
UPDATE "jobs" SET "skill_keys" = COALESCE((SELECT array_agg(DISTINCT lower(s)) FROM unnest("skills") AS s), '{}');
UPDATE "candidate_profiles" SET "skill_keys" = COALESCE((SELECT array_agg(DISTINCT lower(s)) FROM unnest("skills") AS s), '{}');
