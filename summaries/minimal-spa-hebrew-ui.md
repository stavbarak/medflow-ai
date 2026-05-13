# The minimal Hebrew SPA — why it exists and how it talks to the API

This is a small **React + Vite** app under **`web/`**. It isn’t “the product” on day one—WhatsApp and plain HTTP clients matter too—but it gives humans a **friendly first screen** to prove auth, appointments, and AI answers work.

## What we built

- **RTL + Hebrew UI** from the first paint (`lang="he"`, `dir="rtl"`, a readable Hebrew-friendly font).
- **Login / register** with phone + password, JWT stored in **`localStorage`** (fine for a family prototype; a production app might prefer httpOnly cookies and a BFF).
- **Dashboard**: next appointment (with requirements), a textarea for **AI questions** (`/api/query/answer`), and a simple **table of all appointments**.
- **Dev ergonomics**: Vite **`server.proxy`** forwards **`/api`** to **`localhost:3000`**, so the browser stays same-origin in development and you skip CORS dance class.
- **Production ergonomics**: optional **`VITE_API_BASE_URL`** so the built static files can call your **Railway** (or other) API by full URL.

## Challenges

- **CORS** appears the moment the UI and API live on different domains. The backend grew **`CORS_ORIGINS`**; the frontend grew **`VITE_API_BASE_URL`**. Together they’re the standard modern split.

## Why Vite (and not Next.js here)

For a **tiny** dashboard, **Vite + React** is fewer concepts than a full **Next** app router stack. You’re not SEO-indexing appointment rows; you’re **smoke-testing** APIs. If the SPA grows into a real product, migrating or adding a framework is always an option—**don’t borrow complexity before pain**.

---

*See also: [Deployment](deployment-railway-and-spa.md) for build-time env vars*
