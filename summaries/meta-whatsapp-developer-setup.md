# Setting up the Meta / WhatsApp app (outside this repo, but you’ll need it)

Everything in this document happens in **Meta’s dashboards**, not in MedFlowAI’s Git history. Think of it as a **companion guide** so you don’t feel lost when the code is “done” but WhatsApp still says no.

## What you’re trying to achieve

You want three gifts from Meta:

1. A **WhatsApp Business** context (test or real) attached to your **Business portfolio**.
2. A **Phone Number ID** and an **access token** that your server can use to **send** messages.
3. A **public HTTPS webhook URL** Meta can **POST** to when someone messages you.

MedFlowAI already exposes **`/api/whatsapp/webhook`** for steps (2) and (3). Step (1) is the paperwork.

## A sane order of operations

1. **developers.facebook.com → My Apps → Create app** (or use an existing one).
2. When asked for **use cases**, pick **“Connect with customers through WhatsApp.”**  
   Meta’s sidebar doesn’t always show “WhatsApp” as a top-level item; a lot of configuration hides under **Use cases → that WhatsApp use case → API Setup / Getting started**.
3. **Link a Business portfolio** when prompted. WhatsApp Cloud API is a business product, not a personal account hack.
4. **Choose which WhatsApp Business Account (WABA)** the app may access:
   - **Test WABA** — great for learning webhooks and message shape without your real line.
   - **Your real business number** — only appears once that number is properly registered on your WABA in **WhatsApp Manager** (Business Suite). Consumer WhatsApp and Cloud API don’t always coexist on the same number; migration flows exist—follow Meta’s current wizard, not a blog from 2019.

## Tokens, secrets, and verify strings

| You get / you invent | Where it goes in MedFlowAI |
|----------------------|----------------------------|
| **Temporary access token** (API Setup) | `WHATSAPP_ACCESS_TOKEN` |
| **Phone number ID** | `WHATSAPP_PHONE_NUMBER_ID` |
| **App Secret** (App → Settings → Basic) | `WHATSAPP_APP_SECRET` (signature verification) |
| **Verify token** — **you invent it** | Same string in Meta webhook UI **and** `WHATSAPP_VERIFY_TOKEN` |

## Common “why isn’t it working?” moments

- **“Access token unavailable due to phone registration error.”**  
  Meta is blocking token issuance until **phone registration / WABA attachment** is healthy. Fix it in **WhatsApp Manager** and Meta’s phone flows—not by changing Nest code.

- **“This page is not available”** during registration.  
  Often transient Meta UI, browser extensions, or account state. Try another browser, incognito, later; if it persists, Meta support with your **WABA ID** and **App ID** is the realistic path.

- **Business verification asks for a website.**  
  That’s a Meta business trust step, not something this backend can generate for you. A simple public page (even a one-pager) is often enough to unblock verification if that’s their requirement for your region and business type.

## Test vs production mindset

- **Test numbers / test recipients** let you prove **webhook + reply** loops while Meta paperwork catches up.
- **Production** means a stable token strategy (often **System User** long-lived tokens)—again, follow Meta’s current docs; they rename screens sometimes.

## How this ties back to MedFlowAI

Once Meta can reach your **`https://.../api/whatsapp/webhook`**, and your DB has users whose **`phoneNumber`** matches WhatsApp senders, the bot path in the codebase does the rest: questions → grounded answers; other messages → extraction → new appointments.

You’re not doing anything wrong if **Meta takes longer than coding**—that’s normal for this stack.

---

*Related: [Stage 4 — WhatsApp module](stage-4-whatsapp-module.md) · [Deployment](deployment-railway-and-spa.md) for public HTTPS*
