# Stage 2 — Notes, requirements, and “what’s next?”

Stage 1 gave you **appointments**. Real life immediately asks: *What do we need to bring? Who’s driving? Is the MRI form done?* Stage 2 is about **that** layer—still lightweight, still no calendar product.

## What we built

- **Notes** on appointments end-to-end: create, update, list, and every read path includes them. One `notes` field—not a separate “clinical note” vs “logistics note” split—until a real need appears.
- **Requirements** (checklist items): `description` + **`isDone`**. They belong to an appointment and delete with it (`onDelete: Cascade`), so you never orphan checklist rows.
- **Nested HTTP routes** under each appointment, e.g.  
  `/api/appointments/:id/requirements` — easier to reason about than a flat global `/requirements` namespace.
- **Convenience queries**: **`upcoming`** (with optional `from` + `limit`) and **`next`** (single earliest future slot). “Future” is defined by **`dateTime >= now`** in **UTC**, documented in the README so nobody gets surprised by server vs laptop timezone drift.
- **Unit tests** on the appointment service for those query shapes (mocked Prisma), so refactors don’t silently break “next appointment” logic.

## Challenges

- **Route ordering in Nest.** Static paths like `GET /appointments/upcoming` must be declared **before** `GET /appointments/:id`, otherwise `"upcoming"` gets captured as an id. Classic framework footgun—worth calling out for first-time readers.
- **TypeScript + Jest + strict lint rules** when asserting on mock call arguments. We typed the Prisma `findMany` args explicitly so ESLint stays happy without `any` leaks.

## Why these choices (and not others)

| Choice | Instead of… | Because |
|--------|----------------|----------|
| `isDone` on **Requirement** only | “Done” flag on Appointment | An appointment is still *happening* even when prep tasks are complete; completion belongs on checklist items. |
| UTC storage + README contract | Per-user time zones | Family size is tiny; complexity would explode for little gain. |
| Nested requirements routes | One mega-controller | Mirrors how people think: “this visit’s checklist.” |

## What we skipped on purpose

Recurring appointments, iCal feeds, push notifications, multi-timezone user profiles—none of that. If the family outgrows the app, you’ll *feel* which of those to add first from real usage.

---

*Previous: [Stage 1](stage-1-nest-auth-and-appointments.md) · Next: [Stage 3 — AI](stage-3-ai-extraction-and-queries.md)*
