-- Gender for Hebrew verb agreement (family roster + registered users).
CREATE TYPE "Gender" AS ENUM ('male', 'female');

ALTER TABLE "AllowedPhone" ADD COLUMN "gender" "Gender";

ALTER TABLE "User" ADD COLUMN "gender" "Gender";

-- Gender/labels: set via FAMILY_ALLOWLIST env + prisma:seed (not in git).
