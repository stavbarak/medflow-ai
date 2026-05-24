-- Run after recover script fails with: Unique constraint failed on (familyMemberId)
-- Railway: npx prisma db execute --file scripts/fix-duplicate-family-member-id.sql

DROP INDEX IF EXISTS "User_familyMemberId_key";

-- Re-link every user from phone (if column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'phoneNumber'
  ) THEN
    UPDATE "User" SET "familyMemberId" = NULL;
    UPDATE "User" u
    SET "familyMemberId" = fm."id"
    FROM "FamilyMember" fm
    WHERE fm."phoneNumber" = regexp_replace(u."phoneNumber", '\D', '', 'g');
  END IF;
END $$;

-- One user per familyMemberId: extra users get their own orphan member
DO $$
DECLARE
  r RECORD;
  n int := 0;
BEGIN
  FOR r IN
    SELECT u."id" AS user_id, u."familyMemberId"
    FROM "User" u
    WHERE u."familyMemberId" IS NOT NULL
      AND u."id" NOT IN (
        SELECT DISTINCT ON ("familyMemberId") "id"
        FROM "User"
        WHERE "familyMemberId" IS NOT NULL
        ORDER BY "familyMemberId", "createdAt" ASC NULLS LAST, "id"
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

    UPDATE "User"
    SET "familyMemberId" = 'fm-dup-' || r.user_id
    WHERE "id" = r.user_id;
  END LOOP;
END $$;

-- Orphans without member
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
SET "familyMemberId" = 'fm-orphan-' || u."id"
WHERE u."familyMemberId" IS NULL;

-- Finish schema (safe if already applied)
ALTER TABLE "User" ALTER COLUMN "familyMemberId" SET NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_familyMemberId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_familyMemberId_fkey"
  FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "User_familyMemberId_key" ON "User"("familyMemberId");

ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneNumber";
ALTER TABLE "User" DROP COLUMN IF EXISTS "name";
ALTER TABLE "User" DROP COLUMN IF EXISTS "gender";

DROP TABLE IF EXISTS "AllowedPhone";

SELECT "familyMemberId", count(*) AS users
FROM "User"
GROUP BY "familyMemberId"
HAVING count(*) > 1;
