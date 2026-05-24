-- One script for any partial state. Run once:
-- railway run npx prisma db execute --file scripts/complete-family-migration.sql

CREATE TABLE IF NOT EXISTS "FamilyMember" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyMember_phoneNumber_key" ON "FamilyMember"("phoneNumber");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AllowedPhone') THEN
    DELETE FROM "AllowedPhone" WHERE "phoneNumber" LIKE '+%';
    INSERT INTO "FamilyMember" ("id", "phoneNumber", "displayName", "gender")
    SELECT
      'fm-' || regexp_replace("phoneNumber", '\D', '', 'g'),
      regexp_replace("phoneNumber", '\D', '', 'g'),
      COALESCE(NULLIF(trim("label"), ''), regexp_replace("phoneNumber", '\D', '', 'g')),
      COALESCE("gender", 'male'::"Gender")
    FROM "AllowedPhone"
    WHERE length(regexp_replace("phoneNumber", '\D', '', 'g')) >= 9
    ON CONFLICT ("phoneNumber") DO UPDATE SET
      "displayName" = EXCLUDED."displayName",
      "gender" = EXCLUDED."gender";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'phoneNumber'
  ) THEN
    INSERT INTO "FamilyMember" ("id", "phoneNumber", "displayName", "gender")
    SELECT
      'fm-' || regexp_replace(u."phoneNumber", '\D', '', 'g'),
      regexp_replace(u."phoneNumber", '\D', '', 'g'),
      u."name",
      COALESCE(u."gender", 'male'::"Gender")
    FROM "User" u
    WHERE length(regexp_replace(u."phoneNumber", '\D', '', 'g')) >= 9
    ON CONFLICT ("phoneNumber") DO NOTHING;
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "familyMemberId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'phoneNumber'
  ) THEN
    UPDATE "User" u
    SET "familyMemberId" = fm."id"
    FROM "FamilyMember" fm
    WHERE fm."phoneNumber" = regexp_replace(u."phoneNumber", '\D', '', 'g');
  END IF;
END $$;

INSERT INTO "FamilyMember" ("id", "phoneNumber", "displayName", "gender")
SELECT
  'fm-orphan-' || u."id",
  '9725997' || substr(replace(u."id", '-', ''), 1, 6),
  'משתמש',
  'male'::"Gender"
FROM "User" u
WHERE u."familyMemberId" IS NULL
ON CONFLICT ("phoneNumber") DO NOTHING;

UPDATE "User" u
SET "familyMemberId" = fm."id"
FROM "FamilyMember" fm
WHERE u."familyMemberId" IS NULL
  AND fm."id" = 'fm-orphan-' || u."id";

DROP INDEX IF EXISTS "User_familyMemberId_key";

DO $$
DECLARE
  r RECORD;
  n int := 0;
BEGIN
  FOR r IN
    SELECT u."id" AS user_id
    FROM "User" u
    WHERE u."familyMemberId" IS NOT NULL
      AND u."id" NOT IN (
        SELECT DISTINCT ON ("familyMemberId") "id"
        FROM "User"
        WHERE "familyMemberId" IS NOT NULL
        ORDER BY "familyMemberId", "id"
      )
  LOOP
    n := n + 1;
    INSERT INTO "FamilyMember" ("id", "phoneNumber", "displayName", "gender")
    VALUES (
      'fm-dup-' || r.user_id,
      '9725998' || lpad(n::text, 6, '0'),
      'משתמש',
      'male'::"Gender"
    )
    ON CONFLICT ("phoneNumber") DO NOTHING;
    UPDATE "User" SET "familyMemberId" = 'fm-dup-' || r.user_id WHERE "id" = r.user_id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "familyMemberId" IS NULL) THEN
    RAISE EXCEPTION 'User row(s) still missing familyMemberId';
  END IF;
END $$;

ALTER TABLE "User" ALTER COLUMN "familyMemberId" SET NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_familyMemberId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_familyMemberId_fkey"
  FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "User_familyMemberId_key" ON "User"("familyMemberId");

ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneNumber";
ALTER TABLE "User" DROP COLUMN IF EXISTS "name";
ALTER TABLE "User" DROP COLUMN IF EXISTS "gender";

DROP TABLE IF EXISTS "AllowedPhone";

SELECT 'OK' AS status,
  (SELECT count(*) FROM "FamilyMember") AS family_members,
  (SELECT count(*) FROM "User") AS users;
