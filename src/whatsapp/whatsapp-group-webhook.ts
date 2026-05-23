export type GroupWebhookEvent =
  | {
      field: 'group_lifecycle_update';
      type: 'group_create' | 'group_delete' | string;
      groupId?: string;
      subject?: string;
      inviteLink?: string;
      requestId?: string;
      errors?: unknown[];
    }
  | {
      field: 'group_participants_update';
      type: string;
      groupId?: string;
      reason?: string;
      participants?: string[];
    };

interface GroupWebhookPayload {
  group_id?: string;
  type?: string;
  subject?: string;
  invite_link?: string;
  request_id?: string;
  reason?: string;
  errors?: unknown[];
  added_participants?: Array<{ wa_id?: string; input?: string }>;
}

/** Parse group_* webhook fields from a Meta Cloud API payload. */
export function extractGroupWebhookEvents(body: unknown): GroupWebhookEvent[] {
  const out: GroupWebhookEvent[] = [];
  const root = body as {
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: { groups?: GroupWebhookPayload[] };
      }>;
    }>;
  };

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const field = change.field;
      if (
        field !== 'group_lifecycle_update' &&
        field !== 'group_participants_update' &&
        field !== 'group_settings_update' &&
        field !== 'group_status_update'
      ) {
        continue;
      }
      for (const group of change.value?.groups ?? []) {
        if (field === 'group_lifecycle_update') {
          out.push({
            field,
            type: group.type ?? 'unknown',
            groupId: group.group_id,
            subject: group.subject,
            inviteLink: group.invite_link,
            requestId: group.request_id,
            errors: group.errors,
          });
          continue;
        }
        if (field === 'group_participants_update') {
          out.push({
            field,
            type: group.type ?? 'unknown',
            groupId: group.group_id,
            reason: group.reason,
            participants: (group.added_participants ?? [])
              .map((p) => p.wa_id ?? p.input)
              .filter((id): id is string => Boolean(id)),
          });
        }
      }
    }
  }
  return out;
}

export function formatGroupWebhookEvent(event: GroupWebhookEvent): string {
  if (event.field === 'group_lifecycle_update') {
    if (event.type === 'group_create' && event.inviteLink) {
      return `WhatsApp group ready — subject="${event.subject ?? ''}" group_id=${event.groupId} invite_link=${event.inviteLink}`;
    }
    if (event.errors?.length) {
      return `WhatsApp group lifecycle error (${event.type}): ${JSON.stringify(event.errors)}`;
    }
    return `WhatsApp group lifecycle (${event.type}): group_id=${event.groupId ?? 'n/a'}`;
  }
  if (event.field === 'group_participants_update') {
    const who = event.participants?.join(', ') ?? '';
    return `WhatsApp group participant update (${event.type}, ${event.reason ?? ''}): group_id=${event.groupId} added=${who}`;
  }
  return JSON.stringify(event);
}
