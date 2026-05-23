import type { InboundWhatsappMessage } from './whatsapp-send-target';
import { groupTarget, individualTarget } from './whatsapp-send-target';

interface MetaTextMessage {
  from?: string;
  group_id?: string;
  type?: string;
  text?: { body?: string };
}

/** Parse Cloud API webhook JSON into inbound text messages (1:1 and groups). */
export function extractInboundWhatsappMessages(
  body: unknown,
): InboundWhatsappMessage[] {
  const out: InboundWhatsappMessage[] = [];
  const root = body as {
    entry?: Array<{
      changes?: Array<{
        value?: { messages?: MetaTextMessage[] };
      }>;
    }>;
  };
  for (const e of root.entry ?? []) {
    for (const c of e.changes ?? []) {
      for (const msg of c.value?.messages ?? []) {
        if (msg.type !== 'text' || !msg.text?.body) {
          continue;
        }
        const senderWaId = msg.from ?? '';
        const replyTo = msg.group_id
          ? groupTarget(msg.group_id)
          : individualTarget(senderWaId);
        out.push({
          text: msg.text.body,
          senderWaId,
          replyTo,
        });
      }
    }
  }
  return out;
}
