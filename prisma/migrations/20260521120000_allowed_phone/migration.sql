-- CreateTable
CREATE TABLE "AllowedPhone" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedPhone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedPhone_phoneNumber_key" ON "AllowedPhone"("phoneNumber");

-- Existing users keep access after deploy
INSERT INTO "AllowedPhone" ("id", "phoneNumber", "createdAt")
SELECT 'allow-' || "phoneNumber", "phoneNumber", NOW()
FROM "User"
ON CONFLICT ("phoneNumber") DO NOTHING;
