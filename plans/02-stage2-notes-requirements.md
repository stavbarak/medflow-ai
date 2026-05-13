# Stage 2 — Notes & Requirements

## Goal

Checklist + convenience endpoints for real-life use.

## Tasks

1. **Notes**: Full support on `Appointment` create/update/list.
2. **Requirements**: Prisma model; nested routes under appointments.
3. **Endpoints**: `GET /appointments/upcoming`, `GET /appointments/next`.
4. **Status**: Past/upcoming from `dateTime`; `isDone` only on Requirement.

## Time policy

Use **UTC** for stored `dateTime`; document in README. “Next” = earliest `dateTime >= now` (UTC).

## Intentionally avoided

Recurring appointments, iCal, push notifications, per-user timezones.
