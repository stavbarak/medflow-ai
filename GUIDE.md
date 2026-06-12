# Building a family WhatsApp assistant for medical appointments

*MedFlowAI is a small, real-world project: a Hebrew-speaking bot that helps a family keep one patient’s medical calendar straight. This guide explains how it works at a human level — why we built it this way, how WhatsApp and Meta fit in, how we teach an LLM to answer from our data without making things up, and how we keep chat memory useful without letting it grow forever.*

If you want a compact technical map (modules, tables, file paths), see **[`ARCHITECTURE.md`](ARCHITECTURE.md)**. If you want install commands and env vars, see **[`README.md`](README.md)**.

---

## The problem we were solving

Medical care for one person rarely lives in a single app. Appointments come in as WhatsApp forwards, phone calls, half-remembered times, and prep notes scribbled on paper. A family of a few people needs the same picture — who drives, what to bring, when the oncologist is — without everyone opening a complicated system.

MedFlowAI is deliberately narrow:

- **One patient** (in our deployment, “אבא”).
- **A handful of family members** on an allowlist.
- **Two ways in:** a simple Hebrew web app, or WhatsApp — because that’s where the conversation already happens.

The bot doesn’t diagnose, doesn’t replace the hospital portal, and doesn’t pretend to be a general chatbot. It’s a **shared calendar with a conversational front door**.

---

## One brain, two front doors

Everything funnels into a single NestJS API and one PostgreSQL database:

```
   Family member                    Family member
        │                                  │
        ▼                                  ▼
   WhatsApp chat                      Web browser
   (Meta Cloud API)                   (React SPA + JWT)
        │                                  │
        └──────────────┬───────────────────┘
                       ▼
              NestJS (same services)
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   Appointments    Grounded Q&A    AI extraction
         │             │             │
         └─────────────┴─────────────┘
                       ▼
                 PostgreSQL
```

**Why this matters:** whether someone types “מתי התור הבא?” in the web UI or sends `חנטריש` on WhatsApp, the answer comes from the same appointment rows. There is no “WhatsApp database” and “web database” — only one source of truth.

---

## Part 1 — Making a WhatsApp bot (the Meta side)

WhatsApp bots on the Cloud API are not magic plugins inside WhatsApp. They are **your server** talking to **Meta’s Graph API**, with Meta pushing inbound messages to you over HTTPS.

### What you need from Meta

Think of four separate gifts:

| Gift | What it is | Where it lives in MedFlowAI |
|------|------------|------------------------------|
| **Business + number** | A WhatsApp Business Account (WABA) and a phone line | Meta / WhatsApp Manager — not in code |
| **Phone number ID** | An opaque ID Meta uses in API URLs (not the human `+972…` number) | `WHATSAPP_PHONE_NUMBER_ID` |
| **Access token** | Proof your server may send messages | `WHATSAPP_ACCESS_TOKEN` |
| **Webhook URL** | Public HTTPS endpoint Meta POSTs to when someone messages you | `https://your-host/api/whatsapp` |

You also invent a **verify token** (`WHATSAPP_VERIFY_TOKEN`) — any secret string you choose — and type the same value in Meta’s webhook settings. On first setup, Meta sends a GET request; your server echoes a challenge if the token matches.

Optional but recommended in production: **`WHATSAPP_APP_SECRET`** so you can verify `X-Hub-Signature-256` on inbound POSTs.

### The loop

1. **Inbound:** User messages your business number → Meta POSTs JSON to `/api/whatsapp` → Nest parses text, checks the family roster, classifies intent, builds a reply.
2. **Outbound:** Nest POSTs to `https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages` with your token → Meta delivers the reply.

Receiving and sending use the **same token family**, but they are different HTTP calls. It is very possible — and we hit this in production — for **webhooks to work while sends fail**, usually because the token cannot access the phone number ID you are posting to.

### Wake word and groups

In a **1:1 chat**, every message is for the bot.

In a **group**, the bot ignores traffic unless the message contains the wake word **`חנטריש`**. That prevents it from jumping into normal family chatter.

### Tokens: temporary, permanent, and “why did send break?”

Meta’s **API Setup** page can generate a **temporary** token — great for learning, bad as a long-term secret (it expires).

For production, teams usually create a **System User** token in Business Settings, assign it the WhatsApp app and the correct WABA, and grant `whatsapp_business_messaging` (and related) permissions. You paste that once into Railway or your host; Meta does not show it again.

**Lessons from debugging:**

- Meta’s **“Send message”** button on API Setup often sends the **`hello_world` template**. That template is only allowed from Meta’s **sandbox test number** (`+1 555…`), not from your real business line. A failure there does not mean your bot is broken.
- Error **code 2** (“retry later”, `is_transient: true`) is Meta’s “our API hiccuped” bucket — wait and retry.
- Error **100 / subcode 33** on send (“object does not exist or missing permissions”) almost always means **token ↔ phone number ID ↔ WABA mismatch**. Fix permissions or paste the exact token that already worked in a manual test.
- The bot can **compose a perfect Hebrew reply** and still show silence on the phone if **send** fails — always check server logs for `WhatsApp send failed`, not only whether OpenAI responded.

### Who may talk to the bot

Only phone numbers on the **family roster** (`FamilyMember` table, bootstrapped from `ALLOWED_PHONE_NUMBERS`) get answers. Everyone else gets a short Hebrew rejection. WhatsApp identity is the phone number; web login links a password user to the same roster row.

---

## Part 2 — The AI layer: how the LLM “knows” your data

We do **not** embed documents into a vector database or fine-tune a model on the calendar. The pattern is simpler and easier to reason about:

> **Load facts from Postgres → pass them as JSON → ask the model to answer in Hebrew using only those facts.**

That is **grounded Q&A**, not open-ended chat. The database remains authoritative; the model is a **phrasing layer** at the edge.

### Two different jobs for the same model

| Job | When | Model input | Server still owns |
|-----|------|-------------|-------------------|
| **Extraction** | User books or edits (“יש לאבא תור אונקולוגי ב-17.6 באיכילוב”) | Raw Hebrew text | Parsed dates, `timeKnown`, validated fields, saved rows |
| **Grounded Q&A** | User asks (“מתי העירוי הבא?”, “מי מסיע?”) | Question + **facts JSON** + short history | What counts as true; counts; which appointments exist |

For **writes**, the model proposes structure; deterministic code parses dates, filters notes to what was actually said, and sets `timeKnown=false` when no hour was given so the bot **asks** instead of inventing 12:00.

For **reads**, the model must not invent drivers, times, or counts. Prompts say so explicitly; a **Hebrew-only guard** retries or strips stray Latin words (with a small allowlist for PET, MRI, etc.) so answers stay readable in the family chat.

### Building the facts payload (smart laziness)

`QueryService` always loads **upcoming appointments** (titles, times, locations, transport, open checklist items, useful contacts).

It **conditionally** loads more:

- **Past appointments** when the question sounds historical (“כבר היו”, “עד היום”, “מה היה”).
- **Keyword stats** when the question names a treatment (“כמה עירויי קיטרודה עוד יהיו?”).

That heuristic lives in `src/common/utils/qna-facts-heuristic.ts`. The goal is to give the model enough context without dumping the entire medical history on every “מה שלומך?”.

Example shape (simplified):

```json
{
  "generatedAt": "2026-06-12T15:00:00.000Z",
  "scope": { "kind": "qna", "includePast": false, "upcomingCount": 3 },
  "upcomingAppointments": [ { "title": "עירוי קיטרודה", "dateTime": "…", "timeKnown": true, "location": "איכילוב", "transportUser": { "name": "…" }, "requirements": [ … ] } ],
  "usefulContacts": [ { "name": "ת\"ז של אבא", "value": "…" } ]
}
```

The model sees this blob plus the user’s question plus a few prior turns. It does **not** get SQL, tool use, or the ability to browse the web.

### What we intentionally did not do

- **No RAG over PDFs** (yet) — appointments are structured rows; that is enough for v1.
- **No “model memory”** — nothing is stored inside OpenAI’s thread API; all state is ours.
- **No trusting the model for arithmetic on dates** — formatting uses server-side Hebrew date helpers with `Asia/Jerusalem`.

Some features are **fully deterministic** (no LLM): listing upcoming appointments in WhatsApp when someone sends only `חנטריש`, and saving useful phone numbers from messages like `תשמור את המספר של …: 03-…` via regex.

---

## Part 3 — Conversation memory without bloat

WhatsApp feels conversational. Follow-ups like “ומה עם הבא?” or “ולאונקולוג?” only work if the model sees recent turns. But storing every message forever would **bloat the database**, **inflate token costs**, and **leak stale context** (“the appointment we cancelled yesterday”).

### Strategy: working memory, not an archive

We store **`ConversationTurn`** rows per sender phone (`senderWaId`), each marked `user` or `assistant`.

**On every append**, we prune that sender:

| Rule | Value | Why |
|------|-------|-----|
| **TTL** | 60 minutes | Chat context is for *this session*, not medical records |
| **Cap** | 20 turns kept | Even active threads cannot grow without bound |
| **Read window** | Last **10** turns passed to the model | Enough for follow-ups; not the whole cap |

Prune-on-write happens in `appendTurn()` → `pruneSender()` in the same file (TTL + cap on every new message).

A **daily cron** in `ConversationService.sweepOldData()` deletes turns older than 24 hours and pending actions whose `expiresAt` has passed — belt-and-suspenders if prune-on-write missed anything. Nest runs it via `@nestjs/schedule` (`ScheduleModule.forRoot()` in `app.module.ts`):

```135:151:src/conversation/conversation.service.ts
  /** Belt-and-suspenders daily cleanup for anything prune-on-write missed. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async sweepOldData(): Promise<void> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const turns = await this.prisma.conversationTurn.deleteMany({
      where: { createdAt: { lt: dayAgo } },
    });
    const pending = await this.prisma.pendingAction.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (turns.count || pending.count) {
      this.logger.debug(
        `Conversation sweep: removed ${turns.count} turns, ${pending.count} pending actions`,
      );
    }
  }
```

Medical facts live in **`Appointment`**, not in chat history. When memory expires, the user can still ask “מתי התור?” because the calendar did not forget — only the small talk buffer cleared.

### Pending actions: memory for “we’re mid-flow”

Some flows need one explicit follow-up, stored separately in **`PendingAction`** (at most **one row per sender**):

- **`cancel`** — bot asked “לבטל את התור?”; next “כן” confirms deletion.
- **`awaitTime`** — appointment saved **date-only** (`timeKnown=false`); bot waits for an hour.

Pending rows carry a **short TTL** (5 minutes). If the user ignores the prompt and asks something else, the pending row is consumed and normal routing resumes.

This split — **ephemeral turns** vs **structured pending state** vs **canonical appointments** — keeps behavior predictable without maintaining a full chat log for compliance or analytics.

---

## Part 4 — Testing sends with curl (the boring tool that saves hours)

When the bot goes silent, split the problem:

1. Does **Meta accept an outbound message** with your token and phone number ID?
2. Does **your server** call Meta correctly after processing?

Step 1 should be tested **outside** Nest — exactly like Meta’s API Setup, but with **plain text** (what the bot actually sends), not the `hello_world` template.

Replace `YOUR_TOKEN` with a real `EAA…` string and adjust IDs/numbers to match your app:

```bash
curl -X POST "https://graph.facebook.com/v22.0/1162264563635634/messages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"messaging_product":"whatsapp","to":"972523211743","type":"text","text":{"body":"Hello from curl"}}'
```

Success looks like:

```json
{"messages":[{"id":"wamid.HBgLO..."}]}
```

### Hebrew in curl (use a heredoc)

Pasting Hebrew inside a one-line `-d '…'` often breaks JSON in the shell — Meta then returns misleading errors like “`messaging_product` is required” because the body never parsed. The bot itself sends UTF-8 JSON via axios; your terminal might not.

Safer pattern:

```bash
curl -X POST "https://graph.facebook.com/v22.0/1162264563635634/messages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @- <<'EOF'
{
  "messaging_product": "whatsapp",
  "to": "972523211743",
  "type": "text",
  "text": { "body": "בדיקה מהשרת" }
}
EOF
```

### How to read failures

| Response | Likely meaning |
|----------|----------------|
| `{"messages":[{"id":"wamid…"}]}` | Send path OK — debug Nest/webhook next |
| `code 190` | Invalid or literal `TOKEN` placeholder — paste a real token |
| `code 100` / subcode `33` | Token cannot use this **phone number ID** — fix WABA permissions |
| `code 2`, `is_transient: true` | Meta-side flake — retry |
| `#131058` hello_world | You tried the template from a real business number — use `type:text` instead |
| `#131047` | 24-hour window — message the business number first, then retry |

If curl works with a given token but Railway does not, **`WHATSAPP_ACCESS_TOKEN` on the host is not the same string** — sync them and redeploy.

---

## Part 5 — What a message actually does (WhatsApp)

A simplified path for a question in a 1:1 chat:

```
Inbound text
    → allowed phone?
    → pending action to resolve? (cancel / awaitTime)
    → classify intent (list / question / create / update / cancel)
    → list: format upcoming from DB (no LLM)
    → question: build facts JSON + recent turns → grounded answer
    → create/update/cancel: extract fields → AppointmentsService
    → POST reply to Graph API
    → append user + assistant turns to ConversationTurn
```

**List** (`חנטריש` alone) is intentionally LLM-free — fast, cheap, and a good health check when OpenAI or facts loading misbehaves.

**Questions** go through the grounded path. **Creates** merge AI extraction with deterministic date parsing; if the user gave a date but no hour, the bot saves the day and asks “באיזו שעה?” via `PendingAction`.

---

## Closing thoughts

MedFlowAI is small on purpose: one patient, one database, one API, two clients. The interesting engineering is not scale — it is **trust**:

- Meta owns delivery; you own the token and webhook.
- Postgres owns truth; the LLM owns phrasing.
- Conversation tables own **recent context**, not the medical record.

If you are building something similar, steal the patterns, not the domain:

1. **Ground with JSON facts**, not vibes.  
2. **Separate extraction from Q&A** and keep parsers on the server.  
3. **Cap and TTL chat memory**; store workflows in explicit state machines (`PendingAction`).  
4. **Test WhatsApp send with curl** before blaming your orchestration code.  
5. **Read Meta’s error codes literally** — they distinguish their outage, your token, and your template mistakes.

The codebase is open in this repo; [`ARCHITECTURE.md`](ARCHITECTURE.md) maps files to concepts when you are ready to dive in.

---

*MedFlowAI — built for a family coordinating care in Hebrew, one appointment at a time.*
