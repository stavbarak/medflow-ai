import { loadDotEnv } from './load-dotenv';
import { listActiveWhatsAppGroups } from '../src/whatsapp/whatsapp-groups-api';

loadDotEnv();

async function main() {
  const groups = await listActiveWhatsAppGroups();
  if (groups.length === 0) {
    console.log('No active API groups on this business number.');
    console.log('Run: npm run whatsapp:create-group');
    return;
  }
  for (const g of groups) {
    console.log(`${g.id}\t${g.subject}${g.createdAt ? `\t${g.createdAt}` : ''}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
