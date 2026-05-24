# WhatsApp Groups API — not used

The family uses **private 1:1** chats with the business number. Each person sends messages that include the wake word **חנטריש** (see [Stage 4 — WhatsApp](stage-4-whatsapp-module.md)).

We explored Meta’s **Groups API** (On Behalf Of / OBA) but did not adopt it — many numbers hit error **131215** (Groups API not available). The CLI scripts for create/list/invite were removed from this repo.

## What remains in the app

- Inbound webhook still parses `group_id` if Meta ever delivers a group message; replies can use `recipient_type: group`.
- `group_*` lifecycle webhooks are logged only (no bot logic).

You do **not** need to subscribe to `group_*` webhook fields in Meta for the current 1:1 setup.

---

*Index: [summaries/README.md](README.md)*
