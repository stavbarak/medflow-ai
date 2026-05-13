# Stage 3 — AI extraction and grounded questions

By Stage 3, the database already “knows” things. **AI** is not there to invent medical facts—it’s there to **turn messy Hebrew messages into structured rows** and to **phrase answers** from what’s already stored, in natural short Hebrew.

## What we built

- **`AiModule`** wrapping an **OpenAI-compatible** HTTP API (configurable base URL and model). That keeps you from locking into a single vendor forever while still defaulting to a sensible small model for cost and latency.
- **Extraction flow**: model returns JSON → we **`JSON.parse`** → **`class-validator`** + `class-transformer` validate a dedicated DTO (`title`, `dateTime`, `location`, `notes`, nested `requirements[]`). **Never trust raw model output** without that step—bad JSON or wrong shapes should fail loudly, not corrupt the DB.
- **`QueryModule` + `QueryService`**: loads a **facts** payload (upcoming appointments, requirements, responsible names) from Prisma, stringifies it, and asks the model to answer **only** from that JSON. If something isn’t in the facts, the system prompt pushes toward an honest “I don’t know / not stored” style reply in Hebrew.
- **HTTP affordances**: `POST /api/query/answer` for questions, `POST /api/ai/extract` for manual debugging of extraction.
- **Optional `PATIENT_NAME`** env var so prompts can say who the single implicit patient is in Hebrew, without adding a `Patient` table.
- **Tests** focused on **validation** and on **QueryService wiring** (mocked AI—no paid API calls in CI).

## Challenges

- **Hallucination risk** is real even with grounding. Mitigation is architectural: **small facts blob**, strict instructions, and accepting that ambiguous Hebrew dates (“יום חמישי”) will sometimes need human correction in the UI later.
- **Operational dependency**: without `OPENAI_API_KEY`, AI routes return a clear **503-style** message in Hebrew rather than half-working.

## Why these choices (and not others)

| Choice | Instead of… | Because |
|--------|----------------|----------|
| Two-step Q&A (DB → then LLM phrasing) | Let the model query the DB itself (“agent”) | Simpler to reason about, cheaper, fewer failure modes for a family tool. |
| JSON + DTO validation | Unstructured string replies for extraction | You need machine-parseable structure to call Prisma `create` safely. |
| Skip `AiInteraction` audit table | Log every prompt | Scope control; add later if debugging production becomes painful. |

## What we did not build

Tool loops, RAG over PDFs, multi-step planners—these are great for other products; here they would mostly **delay shipping** something the family can use tonight.

---

*Previous: [Stage 2](stage-2-notes-requirements-and-upcoming.md) · Next: [Stage 4 — WhatsApp](stage-4-whatsapp-module.md)*
