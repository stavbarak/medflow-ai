# Stage 4 — WhatsApp as “just another interface”

WhatsApp isn’t a separate product—it’s **the same brain** as the REST API, with a thinner adapter: parse Meta’s webhook, decide intent, call existing services, reply in short Hebrew.

## What we built

- **`WhatsappModule`** with:
  - **`GET /api/whatsapp/webhook`** — Meta’s verification handshake; compare `hub.verify_token` to **`WHATSAPP_VERIFY_TOKEN`** (a string *you* choose and paste in both places).
  - **`POST /api/whatsapp/webhook`** — inbound Cloud API payloads; optional **HMAC verification** of `X-Hub-Signature-256` when **`WHATSAPP_APP_SECRET`** is set. Nest runs with **`rawBody: true`** so signature verification is actually possible (body must be raw bytes, not a re-serialized object).
- **User matching**: normalize Israeli-style numbers and look up **`User.phoneNumber`**. Unknown senders get a gentle Hebrew “register first” style message—or only a log line if outbound isn’t configured.
- **Intent routing** (lightweight heuristic): looks like a **question** → **`QueryService`**; otherwise → **extraction** → create **appointment** (+ requirements when extracted). Always **create** for MVP simplicity—not merge with an existing visit.
- **Outbound**: if **`WHATSAPP_ACCESS_TOKEN`** and **`WHATSAPP_PHONE_NUMBER_ID`** exist, call Graph API `v21.0`; if not, **log** the reply text so local development still proves the pipeline without Meta credentials.

## Challenges (mostly outside the repo)

- **Meta’s UI and business rules** change often; phone registration, business verification, and token issuance can block you even when your Nest code is perfect. We added a separate human-oriented note: [Meta / WhatsApp developer setup](meta-whatsapp-developer-setup.md).
- **Signature + JSON parsing**: frameworks sometimes eat the raw body; we kept raw body explicitly for this one reason.

## Why these choices (and not others)

| Choice | Instead of… | Because |
|--------|----------------|----------|
| Reuse `AppointmentsService`, `QueryService`, `AiService` | Duplicate business rules in WhatsApp layer | One source of truth; WhatsApp can’t drift from the API. |
| Simple question heuristic | Full NLU classifier | Good enough for a family bot; fewer moving parts. |
| Log-only mode without tokens | Hard fail | Lets you develop DB + AI + routing before Meta paperwork is green. |

## What’s still optional / future

Inbound **images** (documents) with storage and optional OCR—designed in the domain model as **`MedicalDocument`**, but the WhatsApp path doesn’t fully wire media download yet. That’s a deliberate “don’t block Stage 4 on file pipelines” cut.

---

*Previous: [Stage 3](stage-3-ai-extraction-and-queries.md) · Next: [Docker & local DB](docker-and-local-database.md)*
