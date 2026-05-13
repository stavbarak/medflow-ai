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

**Role:** **Call OpenAI** for **structured extraction** from free-form Hebrew (or other) text — e.g. turn a pasted message into candidate appointment fields.

**How:** **`AiController`** exposes `POST /api/ai/extract` (JWT), mainly for **debugging and tools**; the heavy logic lives in **`AiService`**, which builds prompts, parses model output, and stays focused on **extraction**, not open-ended chat. Other modules (e.g. WhatsApp) can import **`AiModule`** and reuse **`AiService`** without duplicating API keys or HTTP client setup.

---

### `QueryModule`

**Role:** **Grounded question answering** — answers should come from **what is already stored** (appointments, requirements, …), not from the model’s imagination.

**How:** **`QueryController`** exposes `POST /api/query/answer` with a **question** in the body. **`QueryService`** gathers a **bounded context** from the database (for the current user), sends it to the model with clear instructions, and returns a concise **`answer`**. It **imports `AiModule`** to reuse the same LLM integration path as extraction, while keeping the **Q&A policy** separate from **extraction** code.

---

### `WhatsappModule`

**Role:** **Meta WhatsApp Cloud API** integration — **webhook verification**, **incoming messages**, and orchestration (appointments, requirements, optional AI/query).

**How:** **`WhatsappController`** is **not** behind JWT (Meta calls it). `GET /api/whatsapp/webhook` returns the **hub challenge** when the verify token matches. `POST /api/whatsapp/webhook` receives payloads; the app is bootstrapped with **`rawBody: true`** so **`WhatsappService`** can verify **`X-Hub-Signature-256`** against the raw bytes. The service links external sender identity to your users, updates data through **`AppointmentsService`** / **`RequirementsService`**, and can call **`AiService`** / **`QueryService`** for richer flows. **`WhatsappModule`** **imports** those modules instead of reaching into Prisma for everything—**clear boundaries**, easier to test and to read.

---

### `AppModule` (the root)

**Role:** **Wiring diagram** — turns on global config, database, every feature module, and (when **`client/index.html`** exists in production) **static SPA** hosting for `/` while **`/api/...`** stays the API.

**How:** A single `@Module({ imports: [...] })` list. Order matters for static files: **feature modules first**, **`ServeStaticModule`** last so API routes win for `/api` and the SPA fallback handles client-side routes.

---

## Mental map

```text
HTTP request
    → global prefix /api (except static / from Docker)
    → guards (JWT where applied)
    → controller
    → service(s) + Prisma / OpenAI / WhatsApp helpers
    → JSON (or challenge string for webhook verify)
```

If you remember only one thing: **modules are boundaries**, **services hold behavior**, **controllers are thin HTTP adapters**, and **Prisma + Config + Auth** are the shared foundation everything else stands on.

---

*Index: [summaries/README.md](README.md)*
