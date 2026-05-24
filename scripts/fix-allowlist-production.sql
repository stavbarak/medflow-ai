-- Fix messy AllowedPhone rows on Railway (duplicates, + prefix, test numbers).
-- Run in Postgres Query tab AFTER migrate deploy, then verify with SELECT below.

-- 1) Remove obvious test / wrong numbers
DELETE FROM "AllowedPhone"
WHERE regexp_replace("phoneNumber", '\D', '', 'g') IN (
  '972523211744'
);

-- 2) Remove + prefix duplicates (app always uses 972… without +)
DELETE FROM "AllowedPhone"
WHERE "phoneNumber" LIKE '+%';

-- 3) Load full family roster (names + gender)
INSERT INTO "AllowedPhone" ("id", "phoneNumber", "label", "gender")
VALUES
  ('allow-972523211743', '972523211743', 'סתיו', 'female'),
  ('allow-972528777939', '972528777939', 'אבא', 'male'),
  ('allow-972528080147', '972528080147', 'עדי', 'male'),
  ('allow-972586915656', '972586915656', 'שירי', 'female'),
  ('allow-972796973180', '972796973180', 'שגיא - טלפון עבודה', 'male')
ON CONFLICT ("phoneNumber") DO UPDATE SET
  "label" = EXCLUDED."label",
  "gender" = EXCLUDED."gender";

-- 4) Verify — expect exactly 5 rows, all with label + gender
SELECT "phoneNumber", "label", "gender" FROM "AllowedPhone" ORDER BY "label";
