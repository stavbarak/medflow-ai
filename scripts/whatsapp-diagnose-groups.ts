import { loadDotEnv } from './load-dotenv';
import { listActiveWhatsAppGroups } from '../src/whatsapp/whatsapp-groups-api';
import { readWhatsappGraphCredentials } from '../src/whatsapp/whatsapp-graph.config';

loadDotEnv();

async function main() {
  const { phoneNumberId } = readWhatsappGraphCredentials();
  const masked =
    phoneNumberId.length > 6
      ? `${phoneNumberId.slice(0, 3)}…${phoneNumberId.slice(-3)}`
      : '(set)';
  console.log(`WHATSAPP_PHONE_NUMBER_ID: ${masked}`);
  console.log('Checking Groups API access (GET /groups)…\n');
  try {
    const groups = await listActiveWhatsAppGroups();
    console.log('Groups API: OK');
    console.log(`Active groups: ${groups.length}`);
    for (const g of groups) {
      console.log(`  - ${g.subject} (${g.id})`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
