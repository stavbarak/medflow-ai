import { loadDotEnv } from './load-dotenv';
import { sendGroupInviteTemplate } from '../src/whatsapp/whatsapp-groups-api';

loadDotEnv();

async function main() {
  const [, , groupId, ...phones] = process.argv;
  if (!groupId || phones.length === 0) {
    console.error(
      'Usage: npm run whatsapp:send-group-invite -- <GROUP_ID> <phone> [phone...]',
    );
    console.error('Example: npm run whatsapp:send-group-invite -- Y2FwaV9... 972521234567');
    process.exit(1);
  }

  const templateName = process.env.WHATSAPP_GROUP_INVITE_TEMPLATE_NAME?.trim();
  if (!templateName) {
    console.error(
      'Set WHATSAPP_GROUP_INVITE_TEMPLATE_NAME in .env (approved Group invite link template in Meta).',
    );
    process.exit(1);
  }
  const templateLang =
    process.env.WHATSAPP_GROUP_INVITE_TEMPLATE_LANG?.trim() ?? 'he';

  for (const phone of phones) {
    await sendGroupInviteTemplate({
      toPhone: phone,
      groupId,
      templateName,
      templateLang,
    });
    console.log(`Invite template sent to ${phone.replace(/\D/g, '')}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
