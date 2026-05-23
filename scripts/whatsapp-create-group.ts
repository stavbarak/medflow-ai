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
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('131215')) {
    console.error(
      '\nThis number is not eligible for Groups API. Confirm Official Business Account (OBA) on the number in WhatsApp Manager.',
    );
  } else if (msg.includes('131211')) {
    console.error('\nGroup create limit reached for this business number.');
  } else if (/not registered|131031/i.test(msg)) {
    console.error(
      '\nPhone may not be registered for Cloud API. In WhatsApp Manager, complete number verification and API registration.',
    );
  }
  process.exit(1);
});
