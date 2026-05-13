# Stage 1 — Basic Backend

## Goal

Runnable API: auth + users + appointment CRUD + Hebrew seed.

## Tasks

1. Initialize NestJS (strict TS, global ValidationPipe).
2. Prisma + PostgreSQL (`DATABASE_URL` in `.env.example`).
3. Schema: `User`, `Appointment` with optional `responsibleUserId`.
4. Auth: register/login with **phone + password**, bcrypt, JWT.
5. Users: minimal CRUD / profile.
6. Appointments: CRUD + list; DTOs with class-validator.
7. Seed: Hebrew sample data.

## Acceptance

- [ ] `npm run build` succeeds
- [ ] Migrations apply cleanly
- [ ] Register + login return JWT
- [ ] Protected routes reject without token
- [ ] Full appointment CRUD works
- [ ] Seed inserts Hebrew examples

## Intentionally out of scope

Requirements, documents, AI, WhatsApp, refresh tokens, RBAC beyond optional `role`.
