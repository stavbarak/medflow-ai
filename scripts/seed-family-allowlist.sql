-- Family allowlist (run on Railway Postgres after migrate deploy)
-- psql $DATABASE_URL -f scripts/seed-family-allowlist.sql

INSERT INTO "AllowedPhone" ("id", "phoneNumber", "label")
VALUES
  ('allow-972523211743', '972523211743', 'סתיו'),
  ('allow-972528777939', '972528777939', 'אבא'),
  ('allow-972528080147', '972528080147', 'עדי'),
  ('allow-972586915656', '972586915656', 'שירי'),
  ('allow-972796973180', '972796973180', 'שגיא - טלפון עבודה')
ON CONFLICT ("phoneNumber") DO UPDATE SET "label" = EXCLUDED."label";
