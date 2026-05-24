-- FamilyMember replaces AllowedPhone; User links by id (gender/name/phone live on FamilyMember).

CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyMember_phoneNumber_key" ON "FamilyMember"("phoneNumber");

-- Drop + prefix duplicates before copy
DELETE FROM "AllowedPhone" WHERE "phoneNumber" LIKE '+%';

INSERT INTO "FamilyMember" ("id", "phoneNumber", "displayName", "gender")
SELECT
    CASE WHEN "id" LIKE 'allow-%' THEN 'fm-' || substring("id" from 7) ELSE "id" END,
    regexp_replace("phoneNumber", '\D', '', 'g'),
    COALESCE(NULLIF(trim("label"), ''), regexp_replace("phoneNumber", '\D', '', 'g')),
    COALESCE("gender", 'male'::"Gender")
FROM "AllowedPhone"
WHERE length(regexp_replace("phoneNumber", '\D', '', 'g')) >= 9
ON CONFLICT ("phoneNumber") DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    "gender" = EXCLUDED."gender";

INSERT INTO "FamilyMember" ("id", "phoneNumber", "displayName", "gender")
SELECT
    'fm-' || regexp_replace(u."phoneNumber", '\D', '', 'g'),
    regexp_replace(u."phoneNumber", '\D', '', 'g'),
    u."name",
    COALESCE(u."gender", 'male'::"Gender")
FROM "User" u
WHERE length(regexp_replace(u."phoneNumber", '\D', '', 'g')) >= 9
  AND NOT EXISTS (
    SELECT 1 FROM "FamilyMember" fm
    WHERE fm."phoneNumber" = regexp_replace(u."phoneNumber", '\D', '', 'g')
  )
ON CONFLICT ("phoneNumber") DO NOTHING;

ALTER TABLE "User" ADD COLUMN "familyMemberId" TEXT;

UPDATE "User" u
SET "familyMemberId" = fm."id"
FROM "FamilyMember" fm
WHERE fm."phoneNumber" = regexp_replace(u."phoneNumber", '\D', '', 'g');

-- Orphan users (should not happen): create member then link
INSERT INTO "FamilyMember" ("id", "phoneNumber", "displayName", "gender")
SELECT
    'fm-' || regexp_replace(u."phoneNumber", '\D', '', 'g'),
    regexp_replace(u."phoneNumber", '\D', '', 'g'),
    u."name",
    COALESCE(u."gender", 'male'::"Gender")
FROM "User" u
WHERE u."familyMemberId" IS NULL
  AND length(regexp_replace(u."phoneNumber", '\D', '', 'g')) >= 9
ON CONFLICT ("phoneNumber") DO NOTHING;

UPDATE "User" u
SET "familyMemberId" = fm."id"
FROM "FamilyMember" fm
WHERE u."familyMemberId" IS NULL
  AND fm."phoneNumber" = regexp_replace(u."phoneNumber", '\D', '', 'g');

ALTER TABLE "User" ALTER COLUMN "familyMemberId" SET NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_familyMemberId_fkey"
  FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "User_familyMemberId_key" ON "User"("familyMemberId");

ALTER TABLE "User" DROP COLUMN "phoneNumber";
ALTER TABLE "User" DROP COLUMN "name";
ALTER TABLE "User" DROP COLUMN "gender";

DROP TABLE "AllowedPhone";
