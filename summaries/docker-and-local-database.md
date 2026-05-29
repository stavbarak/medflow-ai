# Docker and the local database — fewer “works on my machine” mysteries

This section is about **how we run Postgres locally** and the small **paper cuts** we hit so you don’t have to rediscover them alone.

## What we added

- **`docker-compose.yml`** — a single **`postgres:16-alpine`** service with a **named volume** so data survives `docker compose down`. Credentials match **`.env.example`** (`postgres` / `postgres`, database `medflow`) so copy-paste onboarding stays boring—in a good way.

## The port story (a very human problem)

Lots of developers already have **PostgreSQL on port 5432**. Binding Docker to the same port fails with “address already in use.”

We moved the **host** port mapping a couple of times (**5433**, then **5434**) as real machines kept colliding with other tools. The lesson isn’t “magic port 5434”—it’s: **the left side of `host:container` is yours to change** until nothing else listens there, and **`DATABASE_URL` must match.**.

## The seed script surprise

`package.json` originally ran Prisma seed through **`ts-node --compiler-options '{"module":"CommonJS"}'`**. Shells love to strip or mangle quotes, which produced hilariously invalid JSON and a cryptic parse error.

**Fix:** a tiny dedicated **`prisma/tsconfig.seed.json`** and a script line that only passes **`--project prisma/tsconfig.seed.json`**. No inline JSON in shell strings; fewer tears.

## Why Docker Compose here (and not “install Postgres globally”)

| Approach | Tradeoff |
|----------|----------|
| **Docker Compose** | Everyone gets the same Postgres version and env; onboarding is one command. Requires Docker Desktop (or engine) installed. |
| **Local Postgres.app / brew** | Great if you already like it—but then `DATABASE_URL` differs per machine and beginners fight `peer` auth and socket paths. |

We optimized for **repeatable first run** in a learning repo, not for minimal disk usage.

## Quick mental model

- **Container port** `5432` is always Postgres inside the box.
- **Host port** is whatever you map (e.g. `5434:5432`).
- Your **Nest app runs on the host** (or in another container later) and connects to **`localhost:<host-port>`**.

## Family roster in the database

After migrate + seed, open **`FamilyMember`** (not the old `AllowedPhone` table). Each row is one person: phone, Hebrew `displayName`, `gender`. Web logins live in **`User`** and point at `familyMemberId`.

Set the allowed phones in `.env` (an access list — names/gender live in the `FamilyMember` table, set at registration):

```env
ALLOWED_PHONE_NUMBERS=972521234567,972529876543
# optional bootstrap: ALLOWED_PHONE_NUMBERS=972521234567:שם:female,972529876543:שם2:male
```

Then `npm run prisma:seed` (creates a row per phone; only fills name/gender when the env supplies them). Full ER diagrams and flows: [**Database schema & connections**](database-schema-and-connections.md).

---

*Next: [Database schema & connections](database-schema-and-connections.md) · [Meta / WhatsApp developer setup](meta-whatsapp-developer-setup.md) · [Deployment](deployment-railway-and-spa.md)*
