-- Gender for Hebrew verb agreement (family roster + registered users).
CREATE TYPE "Gender" AS ENUM ('male', 'female');

ALTER TABLE "AllowedPhone" ADD COLUMN "gender" "Gender";

ALTER TABLE "User" ADD COLUMN "gender" "Gender";

UPDATE "AllowedPhone" SET "gender" = 'female' WHERE "phoneNumber" = '972523211743';
UPDATE "AllowedPhone" SET "gender" = 'male' WHERE "phoneNumber" = '972528777939';
UPDATE "AllowedPhone" SET "gender" = 'male' WHERE "phoneNumber" = '972528080147';
UPDATE "AllowedPhone" SET "gender" = 'female' WHERE "phoneNumber" = '972586915656';
UPDATE "AllowedPhone" SET "gender" = 'male' WHERE "phoneNumber" = '972796973180';
