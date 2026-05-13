# Deployment — Docker, Railway, and why not “just Vercel the whole thing”

This note explains **how we ship** MedFlowAI to the internet: what files exist, what they do, and why **Railway** (or similar) fits the **API + database** part better than a frontend-only host.

## What we added for deployment

### `Dockerfile` (the honest packaging story)

We build a **single container image** that:

1. Uses **Node 20 on Debian bookworm-slim** (not Alpine) to reduce “fun” OpenSSL / libc surprises with **Prisma’s native binaries**.
2. Installs **`openssl`** and CA certs—Prisma and HTTPS clients expect a normal trust store.
3. Copies **`package.json` / lockfile**, **`prisma/`**, **`src/`**, and Nest config files—**not** the whole monorepo junk drawer (see `.dockerignore`).
4. Runs **`npm ci` → `prisma generate` → `nest build`** at image build time so the running container already contains **`dist/`**.
5. Starts with: **`prisma migrate deploy`** then **`node dist/src/main.js`** (Nest emits `src/` under `dist/` with the current `tsconfig`).  
   That means every deploy applies pending migrations **before** accepting traffic—simple and explicit.

### `.dockerignore`

Keeps **node_modules**, local **dist**, **web** build artifacts, **.env**, **plans**, tests, etc. out of the build context. Faster builds, smaller context, fewer accidental secret leaks.

### `railway.toml`

Tells **Railway** to use the **Dockerfile** builder rather than guessing wrong with a generic Node buildpack. Fewer “it worked locally” mismatches.

### CORS and the SPA

Browsers block cross-origin calls unless the API allows them. We added **`CORS_ORIGINS`** (comma-separated) so your **hosted** Vite/React site can call the Railway API while **localhost** dev URLs remain allowed by default.

The **`web/`** app gained optional **`VITE_API_BASE_URL`**: in dev, empty string keeps **relative `/api`** + Vite proxy; in prod build, you set it to your **Railway public URL** so `fetch` hits the right host.

## Why Railway (for this API) vs “just use Vercel”

**Vercel is wonderful** at hosting **static sites** and **short-lived serverless functions**. It is not the natural home for:

- A **long-lived NestJS** HTTP server with **raw body** handling for webhooks,
- A **persistent Prisma connection** pattern typical of traditional servers,
- **Side-by-side Postgres** on the same platform with one-click env wiring.

**Railway** (and similar: **Render**, **Fly.io**, a small **VPS**) fits **“Node + Postgres + always-on HTTP”** in one mental model:

- Add a **PostgreSQL** plugin; **`DATABASE_URL`** appears as a variable you reference into the API service.
- Generate an **HTTPS URL** for the API—exactly what **Meta webhooks** want.
- Run **migrations on boot** via the Docker `CMD` we chose.

Could you force this onto Vercel with enough adapters? Maybe. Would it be simpler for a learner maintaining a family tool? Usually **no**.

## Typical Railway checklist (human version)

1. **Push** this repo to GitHub.
2. **New Railway project → Deploy from GitHub** → select repo.
3. **Add Postgres** → connect **`DATABASE_URL`** into the API service.
4. Set **`JWT_SECRET`** (and AI / WhatsApp vars when ready).

### If the container exits right away (common)

- **`JWT_SECRET` missing** — Nest throws `Configuration key "JWT_SECRET" does not exist` during boot. Fix: add **`JWT_SECRET`** in Railway → your API service → **Variables** (long random string), then redeploy.
- **`DATABASE_URL` missing** — fails at **`prisma migrate deploy`** in the Docker `CMD`. Fix: add Postgres to the project and **reference** its `DATABASE_URL` on the API service (same variable name Prisma expects).

Railway’s UI sometimes labels the stack as **Node** even when the **Dockerfile** builds the image; what matters is that the service actually builds from the repo **`Dockerfile`** (see [`railway.toml`](railway.toml)). If you ever see an unexpected Node version, open **Settings → Build** and confirm **Dockerfile** is selected.
5. **Generate a public domain** for the service.
6. Point Meta’s webhook to **`https://<that-domain>/api/whatsapp/webhook`**.
7. **Seed once** from a Railway shell: `npm run prisma:seed`.

## SPA hosting (separate concern)

The **`web/`** folder is a **static Vite build**. You can host **`web/dist`** on **Vercel**, **Netlify**, **Cloudflare Pages**, or anywhere static files live—then set **`VITE_API_BASE_URL`** at build time and **`CORS_ORIGINS`** on Railway to that site’s origin.

That’s two small hosts doing what each is good at: **API + DB** on Railway, **UI** on a static CDN.

## Challenges worth naming

- **First deploy** before migrations exist: Postgres is empty; `migrate deploy` applies our checked-in SQL migrations—good. If you hand-edit production DB outside Prisma, you’ll eventually fight drift—don’t.
- **Secrets**: never commit `.env`; Railway’s variable UI is the source of truth in prod.

---

*Index: [summaries/README.md](README.md) · Local Docker: [docker-and-local-database.md](docker-and-local-database.md)*
