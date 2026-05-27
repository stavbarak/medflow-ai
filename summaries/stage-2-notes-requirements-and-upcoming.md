# Stage 2 — Notes, requirements, and “what’s next?”

Stage 1 gave you **appointments**. Real life immediately asks: *What do we need to bring? Who’s driving? Is the MRI form done?* Stage 2 is about **that** layer—still lightweight, still no calendar product.

## The backend story: turning “appointments” into “care logistics”

Stage 2 is where the backend stops being “a CRUD demo” and starts being a tool a family can rely on daily:

- A single appointment now has **context** (notes) and **action items** (requirements/checklist).
- Those extra fields flow through every read path: list screens, “next appointment”, and later the AI facts payload.
- The API shape stays simple: requirements are **nested under an appointment** so you never wonder “which visit is this checklist for?”

If you want the code map:

- **Appointment storage** still lives in `src/appointments/appointments.service.ts`
- **Checklist storage** lives in `src/requirements/requirements.service.ts`
- The “what’s next?” logic is just query shape + ordering, exposed as routes in `src/appointments/appointments.controller.ts`

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

## Routes added/extended in Stage 2 (and who owns them)

Everything is still under `/api`:

### Appointment convenience queries

In `src/appointments/appointments.controller.ts` (JWT required):

- **`GET /api/appointments/next`** → `AppointmentsService.next()`  
  “the single next appointment”, used for a quick home screen widget.
- **`GET /api/appointments/upcoming`** → `AppointmentsService.upcoming(from, limit)`  
  used by the UI and by the “facts payload” for AI.

### Requirements (checklists)

In `src/requirements/requirements.controller.ts` (JWT required):

- **`POST /api/appointments/:appointmentId/requirements`** → create requirement
- **`GET /api/appointments/:appointmentId/requirements`** → list requirements
- **`PATCH /api/appointments/:appointmentId/requirements/:requirementId`** → update (including `isDone`)
- **`DELETE /api/appointments/:appointmentId/requirements/:requirementId`** → remove

The controller is thin; the behavior lives in `src/requirements/requirements.service.ts`.

## Why these choices (and not others)

| Choice | Instead of… | Because |
|--------|----------------|----------|
| `isDone` on **Requirement** only | “Done” flag on Appointment | An appointment is still *happening* even when prep tasks are complete; completion belongs on checklist items. |
| UTC storage + README contract | Per-user time zones | Family size is tiny; complexity would explode for little gain. |
| Nested requirements routes | One mega-controller | Mirrors how people think: “this visit’s checklist.” |

## What we skipped on purpose

Recurring appointments, iCal feeds, push notifications, multi-timezone user profiles—none of that. If the family outgrows the app, you’ll *feel* which of those to add first from real usage.

---

## How Stage 3 AI reads this data

When someone asks a question (web or WhatsApp), **`QueryService.buildFactsPayload`** pulls the next **15** upcoming appointments **including** `notes`, nested **`requirements`** (`description`, `isDone`), and the **responsible** user’s name. That JSON blob is the **only** context the LLM gets for Q&A—so rich notes and checklists here directly improve bot answers.

WhatsApp **create/update** can also **write** requirements via extraction (`requirements[]` in the model JSON). See [Stage 3 walkthroughs](stage-3-ai-extraction-and-queries.md).

---

*Previous: [Stage 1](stage-1-nest-auth-and-appointments.md) · Next: [Stage 3 — AI](stage-3-ai-extraction-and-queries.md)*
