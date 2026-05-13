# Stage 3 — AI Layer

## Goal

Extraction from Hebrew text + grounded Q&A from stored data.

## Env

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default sensible)
- `OPENAI_BASE_URL` (optional, OpenAI-compatible)

## Extraction output shape

Validated DTO (partial): `title`, `dateTime`, `location`, `notes`, `requirements[]` with `description`.

## Query flow

1. Load facts from DB (appointments, requirements).
2. LLM formats short Hebrew answer **only** from provided JSON; if unknown → Hebrew uncertainty phrase.

## Tests

- Unit: validation of extraction payloads (mocked or fixture JSON).
- Focus on validation and grounding behavior, not live API calls by default.

## Out of scope

Agent loops, tool chains, RAG over documents.
