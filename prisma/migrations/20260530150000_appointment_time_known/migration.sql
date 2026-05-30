-- Persist whether an appointment's clock time is actually known.
-- New rows default to true (web/API always supply a real time).
ALTER TABLE "Appointment" ADD COLUMN "timeKnown" BOOLEAN NOT NULL DEFAULT true;

-- Legacy backfill: rows stored at the old "noon anchor" (12:00 Asia/Jerusalem)
-- were date-only placeholders. We have no other signal for old data, so treat
-- those as time-unknown. Going forward the flag is set explicitly on write.
UPDATE "Appointment"
SET "timeKnown" = false
WHERE (("dateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem')::time = TIME '12:00');
