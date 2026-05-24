-- Optional manual seed (prefer ALLOWED_PHONE_NUMBERS + npm run prisma:seed).
-- Copy to seed-family-allowlist.sql (gitignored) if you prefer SQL.

INSERT INTO "FamilyMember" ("id", "phoneNumber", "displayName", "gender")
VALUES
  ('fm-972521234567', '972521234567', 'דוגמה', 'female'),
  ('fm-972529876543', '972529876543', 'דוגמה2', 'male')
ON CONFLICT ("phoneNumber") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "gender" = EXCLUDED."gender";
