-- Dedicated field for who drives / how the patient gets to the appointment.
ALTER TABLE "Appointment" ADD COLUMN "transport" TEXT NOT NULL DEFAULT '';
