# WhatsApp Groups API — setup (OBA)

MedFlowAI can reply **in the family group** (not only in private chat) once you complete Meta’s Groups flow. Your code already uses the wake word `חנטריש` so normal group chatter is ignored.

**Official docs:** [Get started with Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/get-started) · [Group messaging](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/)

---

## Important: not a normal WhatsApp group

You **cannot** add the business number to an existing family group like a friend.

Meta’s model:

1. **You create an API group** (invite-only, max **8** participants).
2. You send each family member an **invite link** (approved template).
3. They **join** that group.
4. Messages with `group_id` hit your webhook; replies use `recipient_type: "group"`.

1:1 chat with the business number still works for OTP / private use.

---

## What we implemented in code

| Piece | Behavior |
|--------|----------|
| **Inbound webhook** | Reads `group_id` on messages; `from` = who sent |
| **Outbound** | Replies to the **same** place (group or DM): `recipient_type: group` + group id |
| **OTP / password reset** | Still **1:1 only** (templates to a phone number) |

After deploy, redeploy Railway with the latest commit.

---

## Your checklist (Meta + family)

### 1. App webhooks (Meta Developer Console)

On your app → **WhatsApp** → **Configuration** → Webhook, ensure subscribed:

- `messages` (already required)
- `group_lifecycle_update`
- `group_participants_update`
- `group_settings_update`
- `group_status_update`

Callback URL stays: `https://<your-railway-host>/api/whatsapp`

### 2. Create the group (API)

Use [Create Group](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference#create-group) with your `WHATSAPP_PHONE_NUMBER_ID` and access token.

You’ll get a webhook with **`invite_link`**. Save the **`group_id`** from lifecycle webhooks — you need it for debugging.

### 3. Invite family (template)

1. [Template Library](https://business.facebook.com/wa/manage/template-library) → **Group invite link** template → submit for approval.
2. Send invite via [Send Group Invite Link Template Message](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference#send-group-invite-link-template-message).
3. Each person opens the link and **joins** (max 8).

### 4. Test in the group

In the **API group** (not your old family group):

- `חנטריש` → list appointments  
- `חנטריש לאבא יש תור ב-…` → create  
- `חנטריש מי מלווה…` → question  

Bot should answer **in the group thread**.

### 5. Railway env (unchanged unless you want defaults)

Existing vars are enough:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`

No extra env var is required for groups — the server learns `group_id` from each inbound message.

---

## Limits to plan for

- **8 participants** max per API group (split or use 1:1 for larger circles).
- **Per-message pricing** for group messages.
- No interactive buttons / calls in groups (text is fine).
- **One** Cloud API business per group.

---

## If something fails

| Symptom | Likely cause |
|---------|----------------|
| No webhook when someone writes in group | User didn’t join via invite link; or group webhook fields not subscribed |
| Bot replies in DM but not in group | Old deploy without `recipient_type: group` — redeploy |
| `recipient_type and to type do not match` | Sending to phone number instead of `group_id` — fixed in latest code |
| Invite won’t send | Group invite template not approved |

Check Railway logs for `Wake message from … (group)` after someone writes `חנטריש` in the API group.

---

*See also: [Meta / WhatsApp developer setup](meta-whatsapp-developer-setup.md) · [Stage 4 — WhatsApp](stage-4-whatsapp-module.md)*
