# WhatsApp Groups API — setup (OBA)

MedFlowAI replies **in the family group** once you complete Meta’s Groups flow. Wake word `חנטריש` keeps normal group chatter ignored.

**Official docs:** [Get started with Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/get-started) · [Group messaging](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/)

---

## Step-by-step (do in order)

### 1. Meta webhooks

Developer Console → WhatsApp → Configuration → subscribe:

- `messages`
- `group_lifecycle_update`
- `group_participants_update`
- `group_settings_update`
- `group_status_update`

Callback: `https://<your-railway-host>/api/whatsapp`

### 2. Deploy latest code

Railway must run the build with **group webhook logging** and **group reply** support (`recipient_type: group`).

### 3. Create the group (CLI)

From the repo root with `.env` containing `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`:

```bash
npm run whatsapp:create-group
```

Optional custom name:

```bash
npm run whatsapp:create-group -- "חנטריש — תורים משפחתיים" "תיאום תורים למשפחה"
```

Meta returns `request_id` immediately. Within seconds, **Railway logs** show:

```text
WhatsApp group ready — subject="..." group_id=... invite_link=https://chat.whatsapp.com/...
```

You can also list groups later:

```bash
npm run whatsapp:list-groups
```

### 4. Approve invite template (Meta UI, one-time)

1. [Template Library](https://business.facebook.com/wa/manage/template-library)
2. **Group invite link** → pick template → name it (e.g. `medflow_family_group_invite`) → Submit
3. Wait for approval (can take up to ~24h)

Add to `.env` / Railway:

```env
WHATSAPP_GROUP_INVITE_TEMPLATE_NAME=medflow_family_group_invite
WHATSAPP_GROUP_INVITE_TEMPLATE_LANG=he
```

### 5. Invite family (CLI)

Use `group_id` from step 3 logs. One phone per family member (max **8** in the group):

```bash
npm run whatsapp:send-group-invite -- <GROUP_ID> 972521234567 972523211743
```

Each person opens the invite in WhatsApp and **joins**.

Alternative: share `invite_link` from logs manually (template is nicer for people who never messaged the business number).

### 6. Test in the group

In the **new API group**:

- `חנטריש` → list appointments
- `חנטריש לאבא יש תור ב-14.7 בשעה 9:30` → create
- `חנטריש מי מלווה מחר?` → Q&A

Bot answers **in the group**. Logs: `Wake message from … (group)`.

---

## What the code does

| Piece | Behavior |
|--------|----------|
| **Inbound** | Reads `group_id`; `from` = sender |
| **Outbound** | Replies in same thread (group or DM) |
| **Group webhooks** | Logs `invite_link`, joins, errors to Railway |
| **OTP / reset** | Still 1:1 only |

No `WHATSAPP_GROUP_ID` env needed — each message carries its `group_id`.

---

## Limits

- **8 participants** max per API group
- Per-message pricing for group messages
- Cannot add bot to an old regular WhatsApp group — this is a **new** Meta-managed group

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Create group API fails | Confirm OBA + `whatsapp_business_messaging` permission on token |
| No `invite_link` in logs | Subscribe to `group_lifecycle_update`; check webhook URL |
| Invite send fails | Template not approved; wrong `WHATSAPP_GROUP_INVITE_TEMPLATE_NAME` |
| Bot silent in group | Family didn’t join via invite; redeploy latest code |
| Replies only in DM | Old deploy without group send support |

---

*See also: [Meta / WhatsApp developer setup](meta-whatsapp-developer-setup.md)*
