/** Graph API version used for WhatsApp Cloud API calls. */
export const WHATSAPP_GRAPH_API_VERSION = 'v22.0';

export type WhatsappGraphCredentials = {
  accessToken: string;
  phoneNumberId: string;
};

export function readWhatsappGraphCredentials(): WhatsappGraphCredentials {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) {
    throw new Error(
      'Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID (set in .env or Railway)',
    );
  }
  return { accessToken, phoneNumberId };
}

export function graphUrl(path: string): string {
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}${path}`;
}
