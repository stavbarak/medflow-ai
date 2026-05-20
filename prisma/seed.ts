import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** No demo data — use the app or WhatsApp (חנטריש) to add real appointments. */
async function main() {
  console.log(
    'MedFlow seed: no demo rows inserted. Register in the app or message the bot.',
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
