import axios from 'axios';
import {
  graphUrl,
  readWhatsappGraphCredentials,
  type WhatsappGraphCredentials,
} from './whatsapp-graph.config';

export type CreateWhatsAppGroupInput = {
  subject: string;
  description?: string;
  joinApprovalMode?: 'auto_approve' | 'approval_required';
};

export type CreateWhatsAppGroupResult = {
  requestId: string;
};

export type WhatsAppGroupSummary = {
  id: string;
  subject: string;
  createdAt?: string;
};

function authHeaders(creds: WhatsappGraphCredentials) {
  return {
    Authorization: `Bearer ${creds.accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function createWhatsAppGroup(
  input: CreateWhatsAppGroupInput,
): Promise<CreateWhatsAppGroupResult> {
  const creds = readWhatsappGraphCredentials();
  const { data } = await axios.post<{ request_id?: string }>(
    graphUrl(`/${creds.phoneNumberId}/groups`),
    {
      messaging_product: 'whatsapp',
      subject: input.subject.trim(),
      ...(input.description ? { description: input.description.trim() } : {}),
      join_approval_mode: input.joinApprovalMode ?? 'auto_approve',
    },
    { headers: authHeaders(creds) },
  );
  if (!data.request_id) {
    throw new Error('Create group response missing request_id');
  }
  return { requestId: data.request_id };
}

export async function listActiveWhatsAppGroups(): Promise<WhatsAppGroupSummary[]> {
  const creds = readWhatsappGraphCredentials();
  const { data } = await axios.get<{
    data?: { groups?: Array<{ id?: string; subject?: string; created_at?: string }> };
  }>(graphUrl(`/${creds.phoneNumberId}/groups`), {
    headers: authHeaders(creds),
  });
  return (data.data?.groups ?? [])
    .filter((g): g is { id: string; subject: string; created_at?: string } =>
      Boolean(g.id && g.subject),
    )
    .map((g) => ({
      id: g.id,
      subject: g.subject,
      createdAt: g.created_at,
    }));
}

export async function sendGroupInviteTemplate(input: {
  toPhone: string;
  groupId: string;
  templateName: string;
  templateLang?: string;
}): Promise<void> {
  const creds = readWhatsappGraphCredentials();
  const to = input.toPhone.replace(/\D/g, '');
  await axios.post(
    graphUrl(`/${creds.phoneNumberId}/messages`),
    {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.templateLang ?? 'he' },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'group_id',
                group_id: input.groupId,
              },
            ],
          },
        ],
      },
    },
    { headers: authHeaders(creds) },
  );
}
