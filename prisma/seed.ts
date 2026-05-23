import { PrismaClient } from '@prisma/client';
import { normalizeIsraeliPhone } from '../src/common/utils/phone';

const prisma = new PrismaClient();

/** Upsert phones from ALLOWED_PHONE_NUMBERS into AllowedPhone (optional bootstrap). */
async function seedAllowlistFromEnv() {
  const raw = process.env.ALLOWED_PHONE_NUMBERS?.trim();
  if (!raw) {
    return 0;
  }
  let count = 0;
  for (const part of raw.split(',')) {
    const phoneNumber = normalizeIsraeliPhone(part.trim());
    if (!phoneNumber) {
      continue;
    }
    await prisma.allowedPhone.upsert({
      where: { phoneNumber },
      create: { phoneNumber },
      update: {},
    });
    count += 1;
  }
  return count;
}

/** No demo appointments — allowlist bootstrap only when ALLOWED_PHONE_NUMBERS is set. */
async function main() {
  const n = await seedAllowlistFromEnv();
  if (n > 0) {
    console.log(`MedFlow seed: upserted ${n} allowed phone(s) from ALLOWED_PHONE_NUMBERS.`);
  } else {
    console.log(
      'MedFlow seed: no rows added. Set ALLOWED_PHONE_NUMBERS or INSERT into AllowedPhone, then register in the app.',
    );
  }
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
