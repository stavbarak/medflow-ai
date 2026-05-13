# MedFlow AI — Overview

## Principles

- **Single patient, single context**: No `Patient` table; optional `PATIENT_NAME` in env for AI prompts.
- **Few fields, free text**: Prefer strings; avoid heavy enums.
- **Shared services**: HTTP and WhatsApp call the same `AppointmentsService`, `QueryService`, `AiService`.
- **Hebrew for users**: User-visible strings and AI outputs in Hebrew; code and DB in English.
- **Security**: JWT for REST; webhook verification for WhatsApp; secrets from env.

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | NestJS (TypeScript) |
| DB | PostgreSQL |
| ORM | Prisma |
| Validation | class-validator, class-transformer |
| Auth | JWT (Passport) |

## Modules

```
AuthModule, UsersModule, AppointmentsModule, RequirementsModule,
DocumentsModule, AiModule, QueryModule, WhatsAppModule
```

WhatsApp is a thin layer over core services.
