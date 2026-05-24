import { PrismaClient } from '@prisma/client';
import { parseAllowedPhoneNumbersEnv } from '../src/common/utils/family-roster-env';

const prisma = new PrismaClient();

/** Upsert family roster from ALLOWED_PHONE_NUMBERS (phone:name:gender per person). */
async function seedFamilyFromEnv() {
  const raw = process.env.ALLOWED_PHONE_NUMBERS?.trim();
  if (!raw) {
    return 0;
  }
  let count = 0;
  for (const entry of parseAllowedPhoneNumbersEnv(raw)) {
    await prisma.familyMember.upsert({
      where: { phoneNumber: entry.phoneNumber },
      create: {
        id: `fm-${entry.phoneNumber}`,
        phoneNumber: entry.phoneNumber,
        displayName: entry.displayName,
        gender: entry.gender,
      },
      update: {
        displayName: entry.displayName,
        gender: entry.gender,
      },
    });
    count += 1;
  }
  return count;
}

async function main() {
  const n = await seedFamilyFromEnv();
  if (n > 0) {
    console.log(`MedFlow seed: upserted ${n} family member(s) from ALLOWED_PHONE_NUMBERS.`);
  } else {
    console.log(
      'MedFlow seed: no rows added. Set ALLOWED_PHONE_NUMBERS in .env (see .env.example).',
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
