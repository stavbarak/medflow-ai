import { loadDotEnv } from './load-dotenv';
import { createWhatsAppGroup } from '../src/whatsapp/whatsapp-groups-api';

loadDotEnv();

async function main() {
  const subject =
    process.argv[2]?.trim() ||
    process.env.WHATSAPP_GROUP_SUBJECT?.trim() ||
    'חנטריש — תורים של אבא';
  const description =
    process.argv[3]?.trim() ||
    process.env.WHATSAPP_GROUP_DESCRIPTION?.trim() ||
    'קבוצה לתיאום תורים. כתבו חנטריש + בקשה (רשימה, הוספה, שאלה).';

  const result = await createWhatsAppGroup({
    subject,
    description,
    joinApprovalMode: 'auto_approve',
  });

  console.log('Group creation submitted.');
  console.log(`request_id: ${result.requestId}`);
  console.log('');
  console.log(
    'Next: watch Railway logs (or Meta webhook) for group_lifecycle_update',
  );
  console.log('with invite_link and group_id — usually within seconds.');
  console.log('');
  console.log('Then invite family:');
  console.log(
    '  npm run whatsapp:send-group-invite -- <GROUP_ID> 972521234567 ...',
  );
  console.log(
    '(requires approved WHATSAPP_GROUP_INVITE_TEMPLATE_NAME in .env)',
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
