# Stage 4 — WhatsApp Integration

## Goal

Primary UX: inbound message → extract/save or answer → short Hebrew reply.

## Webhook

- `POST` webhook (Meta Cloud API style).
- Verify `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` (when configured).
- Skip verification in dev if secret unset (document risk).

## Routing inbound text

- Heuristic: messages ending with `?` or starting with question words → **QueryService**.
- Otherwise → AI extraction → **create appointment** (MVP: always new).

## Outbound

Short Hebrew, no markdown if unsupported; calm tone.

## Optional media

Download image → store URL/path → `MedicalDocument`; OCR deferred.

## Production extras (not in MVP)

Rate limits, idempotency keys, DLQ, official templates, observability.
