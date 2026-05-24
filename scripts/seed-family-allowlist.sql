-- Family allowlist (run on Railway Postgres after migrate deploy)
-- psql $DATABASE_URL -f scripts/seed-family-allowlist.sql
-- If you see duplicates or NULL labels, use scripts/fix-allowlist-production.sql instead.

DELETE FROM "AllowedPhone" WHERE "phoneNumber" LIKE '+%';
DELETE FROM "AllowedPhone"
WHERE regexp_replace("phoneNumber", '\D', '', 'g') = '972523211744';

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
