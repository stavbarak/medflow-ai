-- Optional: copy to seed-family-allowlist.sql (gitignored) and fill real numbers.
-- Prefer FAMILY_ALLOWLIST in .env — see .env.example and npm run prisma:seed

DELETE FROM "AllowedPhone" WHERE "phoneNumber" LIKE '+%';

INSERT INTO "AllowedPhone" ("id", "phoneNumber", "label", "gender")
VALUES
  ('allow-972521234567', '972521234567', 'שם', 'female'),
  ('allow-972529876543', '972529876543', 'שם אחר', 'male')
ON CONFLICT ("phoneNumber") DO UPDATE SET
  "label" = EXCLUDED."label",
  "gender" = EXCLUDED."gender";
