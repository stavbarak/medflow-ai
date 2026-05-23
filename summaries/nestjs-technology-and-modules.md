# NestJS — how it is built, why we use it, and what each module does

This note is for anyone who opens `src/` and wants the **big picture**: what Nest is doing under the hood, why it fits MedFlowAI, and how the **feature modules** line up with the product.

---

## How Nest is built (the short version)

**NestJS** is a **Node.js** framework written in **TypeScript**. You describe the app with **decorators** (`@Module`, `@Controller`, `@Injectable`, …) and **classes**. At build time, the Nest CLI compiles everything to plain JavaScript in `dist/`; at runtime, Node runs that output like any other server.

The heart of Nest is **dependency injection (DI)**. You rarely `new` services by hand. Instead you **declare providers** (`@Injectable()` classes) and **inject** them into constructors. Nest’s runtime **wires the graph** once at startup: controllers get services, services get `PrismaService`, and so on. That keeps constructors honest (dependencies are explicit) and makes **testing** easier (swap a fake `AiService` behind the same interface).

Nest also organizes code into **modules**—each module is a bounded chunk: “these controllers, these providers, these imports from other modules.” The **root `AppModule`** lists the modules that should exist in the running app. **Guards** (e.g. JWT) run before route handlers; **pipes** validate and transform incoming bodies (`ValidationPipe` is global in our `main.ts`). **Middleware** and **raw body** hooks sit on the HTTP adapter when we need them (WhatsApp signature verification).

So in one sentence: **TypeScript + decorators + a DI container + modular boundaries + HTTP primitives (guards, pipes, filters)** — that is how Nest is “built” and how we use it.

---

## Why Nest serves *this* project well

MedFlowAI is a **long-lived HTTP API** with:

- **Authenticated JSON routes** for a small team or family (JWT, bcrypt).
- **Postgres** via **Prisma** (typed queries, migrations).
- **Optional AI calls** (OpenAI) that must stay **bounded** (extract structured fields, answer from stored context only).
- A **WhatsApp webhook** that needs **raw request bodies** for HMAC verification and a predictable always-on process.

Nest fits that stack because:

1. **Structure without ceremony** — Each domain (`appointments`, `whatsapp`, …) lives in its own folder with a familiar pattern: module, controller, service, DTOs. New readers know where to look.
2. **Cross-cutting concerns are first-class** — Auth is a guard + strategy, not ad-hoc `if` in every handler. Validation is centralized.
3. **Composition** — `WhatsappModule` imports the pieces it needs (`AiModule`, `QueryModule`, …) instead of one giant “god service.”
4. **One deployable unit** — Same process can serve `/api`, run migrations on boot, and (in Docker) **serve the static UI** from `/` via `@nestjs/serve-static`, which is awkward to replicate cleanly in tiny serverless handlers.

We are not chasing infinite scale here; we want **clarity, safety, and a single place** for API + DB + webhooks. Nest optimizes for that.

---

## What each module does (and how)

Paths below are under `src/`. All **HTTP routes** are prefixed with **`/api`** globally (see `main.ts`), so `AuthController`’s `@Controller('auth')` becomes **`/api/auth/...`**.

### `ConfigModule` (in `app.module.ts`)

**Role:** Load **environment variables** (`.env` locally, Railway’s env in production) into a typed **`ConfigService`** used across the app.

**How:** `ConfigModule.forRoot({ isGlobal: true })` registers it once; any provider can inject `ConfigService` for secrets like `JWT_SECRET`, `DATABASE_URL`, or AI keys without reading `process.env` scattered everywhere.

---

### `PrismaModule`

**Role:** Single **database access** layer for the whole app.

**How:** `@Global()` so we do not re-import it in every feature module. It provides **`PrismaService`** (extends Prisma’s generated client, handles connection lifecycle). Services inject `PrismaService` and run queries against **Postgres**. Migrations and schema live in `prisma/`; the client is generated at build time.

---

### `PhoneAllowlistModule`

**Role:** **Family access control** — only approved phone numbers can register, log in, reset passwords, or talk to the WhatsApp bot.

**How:** Global `@Global()` module exposing **`PhoneAllowlistService`**. Checks **`ALLOWED_PHONE_NUMBERS`** (comma-separated env) **or** rows in the **`AllowedPhone`** Prisma table. Used by **`AuthService`** (register/login/forgot) and **`WhatsappService.dispatchMessage`** before any bot logic. Unknown numbers get a Hebrew rejection message—not a silent drop on the web API.

---

### `AuthModule`

**Role:** **Register**, **login**, and everything needed to **issue and validate JWTs**.

**How:** **`AuthController`** exposes `POST /api/auth/register` and `POST /api/auth/login`. **`AuthService`** hashes passwords (bcrypt), creates users, and returns JWTs. **`JwtModule`** is configured asynchronously from `JWT_SECRET` and optional expiry. **`PassportModule`** + **`JwtStrategy`** decode the `Authorization: Bearer` token and attach a **`AuthenticatedUser`** to the request so `@UseGuards(AuthGuard('jwt'))` routes know who is calling.

---

### `UsersModule`

**Role:** **Profile** for the logged-in user.

**How:** **`UsersController`** is JWT-protected. `GET /api/users/me` returns the current user; `PATCH /api/users/me` updates allowed fields. **`UsersService`** wraps Prisma reads/updates. This stays intentionally small: no public user directory, just “me.”

---

### `AppointmentsModule`

**Role:** The **schedule** — each row is an appointment (title, time, location, notes, optional **responsible** user).

**How:** Routes require a **logged-in** user (JWT), but the underlying model is a **shared family-style calendar**: list and detail endpoints return appointments from the database without a separate “only my rows” filter—good enough when everyone who has a login is trusted. **`AppointmentsController`** exposes full CRUD plus **`upcoming`** (from a given date, capped) and **`next`** (single nearest future slot). **`AppointmentsService`** talks to Prisma and validates that IDs exist before updates or deletes.

---

### `RequirementsModule`

**Role:** **Checklist-style requirements** tied to a **specific appointment** (things to bring, prep steps, done/not done).

**How:** Routes are **nested** under `appointments/:appointmentId/requirements` so URLs match the data shape. **`RequirementsService`** makes sure the **parent appointment exists** before creating, listing, updating, or deleting requirements, and keeps `requirementId` tied to the right `appointmentId` so you cannot patch a requirement “into” the wrong visit by accident.

---

### `DocumentsModule`

**Role:** **Medical document records** linked to an appointment: a **URL** (where the file lives — cloud storage, drive link, etc.) plus optional **notes**, and who uploaded it.

**How:** JWT-protected routes under `/api/documents`. **`DocumentsService`** creates rows with **`uploadedByUserId`** set from the current user, optional **`appointmentId`**, **`fileUrl`**, and **`notes`**. List and fetch endpoints return documents **with** related appointment and uploader summaries for the UI; tighten ownership checks later if you need stricter isolation than today’s schema implies.

---

### `AiModule`

**Role:** **All OpenAI HTTP calls** — structured extraction, update reconciliation, notes merge, and grounded Q&A phrasing.

**How:** **`AiController`** exposes `POST /api/ai/extract` (JWT) for debugging. **`AiService`** owns prompts, `JSON.parse`, and post-processing (`mergeWakeAppointmentExtraction`, `filterNotesToSourceText`). It does **not** query Prisma—callers pass text in and get validated fields back. See the full walkthrough with diagrams in [Stage 3 — AI](stage-3-ai-extraction-and-queries.md).

**Key methods:**

| Method | Used by |
|--------|---------|
| `extractAppointmentFromText` | WhatsApp create, `/api/ai/extract` |
| `extractAppointmentUpdateDelta` | WhatsApp update (requirements only) |
| `reconcileAppointmentUpdate` | WhatsApp update (title/location/mergeNotes flag) |
| `mergeAppointmentNotes` | WhatsApp update (companions, transport, prep) |
| `answerQuestionFromFacts` | `QueryService`, WhatsApp questions |

---

### `QueryModule`

**Role:** **Grounded question answering** — read DB first, then ask the model to phrase a Hebrew answer from a JSON facts blob.

**How:** **`QueryController`** → `POST /api/query/answer`. **`QueryService.buildFactsPayload`** loads the next 15 upcoming appointments (with requirements and responsible user). **`formatFactsDumpHebrew`** formats the same data **without** an LLM (WhatsApp `חנטריש` alone). Imports **`AiModule`** only for `answerQuestionFromFacts`. Details: [Stage 3 walkthrough 2](stage-3-ai-extraction-and-queries.md#walkthrough-2--grounded-qa).

---

### `WhatsappModule`

**Role:** **Meta WhatsApp Cloud API** — webhook verification, inbound messages, wake-word orchestration.

**How:** **`WhatsappController`** is **not** JWT-protected. **`WhatsappService`** verifies HMAC, gates on allowlist + registered user, classifies intent (`whatsapp-wake-intent.ts`), and delegates to **`AppointmentsService`**, **`QueryService`**, **`AiService`**. End-to-end flow diagram: [Stage 4](stage-4-whatsapp-module.md).

---

### `AppModule` (the root)

**Role:** **Wiring diagram** — turns on global config, database, every feature module, and (when **`client/index.html`** exists in production) **static SPA** hosting for `/` while **`/api/...`** stays the API.

**How:** A single `@Module({ imports: [...] })` list. Order matters for static files: **feature modules first**, **`ServeStaticModule`** last so API routes win for `/api` and the SPA fallback handles client-side routes.

```15:30:src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PhoneAllowlistModule,
    AuthModule,
    UsersModule,
    AppointmentsModule,
    RequirementsModule,
    DocumentsModule,
    AiModule,
    QueryModule,
    WhatsappModule,
  ],
  controllers: [RootController],
})
```

---

## Module dependency graph

Who imports whom (solid = explicit `imports:` in module file; dashed = global inject):

```mermaid
flowchart TB
  AppModule --> PrismaModule
  AppModule --> PhoneAllowlistModule
  AppModule --> AuthModule
  AppModule --> WhatsappModule
  AppModule --> QueryModule
  AppModule --> AiModule

  QueryModule --> AiModule
  WhatsappModule --> AiModule
  WhatsappModule --> QueryModule
  WhatsappModule --> AppointmentsModule
  WhatsappModule --> RequirementsModule
  WhatsappModule --> UsersModule
  AuthModule --> WhatsappModule

  AuthModule -.-> PhoneAllowlistModule
  WhatsappModule -.-> PhoneAllowlistModule
  QueryModule -.-> PrismaModule
  AiModule -.-> ConfigModule
```

**Notable coupling:** `AuthModule` imports `WhatsappModule` for password-reset OTP over WhatsApp—not the other way around.

---

## Request paths (two front doors)

```mermaid
flowchart LR
  subgraph spa ["Web SPA (JWT)"]
    R[Register / Login] --> JWT[JWT Bearer]
    JWT --> AP[/api/appointments]
    JWT --> Q[/api/query/answer]
    JWT --> E[/api/ai/extract]
  end

  subgraph wa ["WhatsApp (no JWT)"]
    M[Meta webhook] --> W[/api/whatsapp]
    W --> AL{allowlist + user?}
    AL --> INT[intent + services]
  end

  AP --> DB[(Postgres)]
  Q --> DB
  INT --> DB
```

Both paths call the **same services** for appointments and AI—only the adapter differs.

```text
HTTP request
    → global prefix /api (except static / from Docker)
    → guards (JWT where applied)
    → controller
    → service(s) + Prisma / OpenAI / WhatsApp helpers
    → JSON (or challenge string for webhook verify)
```

If you remember only one thing: **modules are boundaries**, **services hold behavior**, **controllers are thin HTTP adapters**, and **Prisma + Config + Auth** are the shared foundation everything else stands on.

For a **deep dive on AI flows** (extraction, Q&A, notes grounding, WhatsApp update pipeline), read [Stage 3 — AI](stage-3-ai-extraction-and-queries.md) next.

---

*Index: [summaries/README.md](README.md)*
