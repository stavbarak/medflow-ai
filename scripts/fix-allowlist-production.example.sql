-- Optional: copy to fix-allowlist-production.sql (gitignored) for one-off prod cleanup.
-- Prefer FAMILY_ALLOWLIST + npm run prisma:seed on Railway shell.

DELETE FROM "AllowedPhone" WHERE "phoneNumber" LIKE '+%';
DELETE FROM "AllowedPhone"
WHERE regexp_replace("phoneNumber", '\D', '', 'g') = '972521234568';

-- Then run your family INSERTs or use prisma:seed with FAMILY_ALLOWLIST set.
