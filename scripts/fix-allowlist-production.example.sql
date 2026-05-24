-- One-off cleanup on production Postgres (then run prisma:seed with ALLOWED_PHONE_NUMBERS).

DELETE FROM "FamilyMember" WHERE "phoneNumber" LIKE '+%';
DELETE FROM "FamilyMember" WHERE "phoneNumber" = '972521234568';
