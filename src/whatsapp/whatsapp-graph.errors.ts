import axios from 'axios';

export function formatWhatsappGraphError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : String(err);
  }
  const status = err.response?.status;
  const data = err.response?.data as
    | {
        error?: {
          message?: string;
          type?: string;
          code?: number;
          error_subcode?: number;
          error_user_title?: string;
          error_user_msg?: string;
          fbtrace_id?: string;
        };
      }
    | undefined;
  const e = data?.error;
  if (!e) {
    return `HTTP ${status ?? '?'}: ${err.message}`;
  }
  const parts = [
    `HTTP ${status}`,
    e.code != null ? `code ${e.code}` : '',
    e.error_subcode != null ? `subcode ${e.error_subcode}` : '',
    e.message,
    e.error_user_title,
    e.error_user_msg,
    e.fbtrace_id ? `trace ${e.fbtrace_id}` : '',
  ].filter(Boolean);
  return parts.join(' — ');
}
