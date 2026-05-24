-- Link transport driver to User; free-text details in transportNotes.
ALTER TABLE "Appointment" ADD COLUMN "transportUserId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "transportNotes" TEXT NOT NULL DEFAULT '';

UPDATE "Appointment" SET "transportNotes" = "transport" WHERE "transport" IS NOT NULL AND "transport" != '';

ALTER TABLE "Appointment" DROP COLUMN "transport";

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_transportUserId_fkey"
  FOREIGN KEY ("transportUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Appointment_transportUserId_idx" ON "Appointment"("transportUserId");
