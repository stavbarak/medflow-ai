# Stage 1 — Nest, auth, and the core data model

If you’re opening this project for the first time, **Stage 1** is the spine: a small API that can authenticate family members and store appointments for one father figure—no hospital ERP fantasy, just something a sibling group can actually run.

## What we built

- **NestJS** in TypeScript, with a global **`/api`** prefix so all routes stay grouped and predictable.
- **Prisma + PostgreSQL** for persistence. The first schema had only what mattered: **`User`** (name, unique phone, optional role, password hash) and **`Appointment`** (title, time, location, notes, optional responsible user).
- **JWT authentication** after register/login with **phone + password**—chosen so the same identifier could later line up with WhatsApp sender IDs without inventing a parallel “email world.”
- **bcrypt** for password hashing, with a documented cost factor in line with common practice.
- **class-validator** on DTOs so bad input fails fast with **Hebrew** messages where the user sees them; code and database stay in English.
- A **seed script** with realistic Hebrew names and appointment copy (hospitals, forms, that kind of family logistics).

## Challenges along the way

- **Node and Prisma versions.** Newer Prisma releases wanted a newer minimum Node version than some developers had installed. Rather than force everyone to upgrade Node immediately, we **pinned Prisma 5.x**, which still behaves like the Prisma you’ll see in most tutorials and runs comfortably on common Node 20 installs.
- **Keeping the model boring on purpose.** It’s tempting to add `Patient`, `Clinic`, `Specialty`, enums everywhere. We resisted: one implicit patient, free-text fields, optional `role` string only. That keeps migrations and mental load small for a 30-day learning project that still has to *work*.

## Why these choices (and not others)

| Choice | Instead of… | Because |
|--------|----------------|----------|
| Phone + JWT | Email-only auth | WhatsApp and family coordination already revolve around phone numbers. |
| Single `Appointment` entity | Rich scheduling subsystem | The product question was “when / where / what to bring?”—not “optimize OR utilization.” |
| Hebrew in validation/errors only | Hebrew variable names | Tooling, diffs, and international collaborators stay easier; UX stays local. |
| Prisma | Raw SQL or a heavier ORM | Fast iteration, type-safe queries, easy seeds—good fit for a small team codebase. |

## What we deliberately did *not* build yet

Refresh tokens, fine-grained RBAC, multi-tenant clinics, audit logs for every read—those belong to a different product phase. Stage 1 was about **credibility**: you can register, log in, and CRUD appointments against a real database.

---

*Next in this series: [Stage 2 — notes, requirements, and “what’s next?”](stage-2-notes-requirements-and-upcoming.md)*
