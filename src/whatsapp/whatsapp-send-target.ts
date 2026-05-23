/** Where an outbound WhatsApp message should be delivered. */
export type WhatsappSendTarget =
  | { type: 'individual'; phone: string }
  | { type: 'group'; groupId: string };

export type InboundWhatsappMessage = {
  text: string;
  /** Participant who sent the message (E.164 without +). */
  senderWaId: string;
  replyTo: WhatsappSendTarget;
};

export function individualTarget(phone: string): WhatsappSendTarget {
  return { type: 'individual', phone: phone.replace(/\D/g, '') };
}

export function groupTarget(groupId: string): WhatsappSendTarget {
  return { type: 'group', groupId: groupId.trim() };
}
