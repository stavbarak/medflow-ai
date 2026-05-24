import { Gender, PrismaClient } from '@prisma/client';
import { parseFamilyAllowlistEnv } from '../src/common/utils/family-allowlist-env';
import { normalizeIsraeliPhone } from '../src/common/utils/phone';

const prisma = new PrismaClient();

/** Upsert phones from ALLOWED_PHONE_NUMBERS (numbers only). */
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

/** Upsert label + gender from FAMILY_ALLOWLIST (phone:label:gender per entry). */
async function seedFamilyAllowlistFromEnv() {
  const raw = process.env.FAMILY_ALLOWLIST?.trim();
  if (!raw) {
    return 0;
  }
  let count = 0;
  for (const entry of parseFamilyAllowlistEnv(raw)) {
    const gender = entry.gender as Gender | undefined;
    await prisma.allowedPhone.upsert({
      where: { phoneNumber: entry.phoneNumber },
      create: {
        id: `allow-${entry.phoneNumber}`,
        phoneNumber: entry.phoneNumber,
        label: entry.label,
        gender,
      },
      update: {
        label: entry.label,
        gender,
      },
    });
    count += 1;
  }
  return count;
}

async function main() {
  const nPhones = await seedAllowlistFromEnv();
  const nFamily = await seedFamilyAllowlistFromEnv();
  const total = nPhones + nFamily;
  if (total > 0) {
    console.log(
      `MedFlow seed: ${nPhones} phone(s) from ALLOWED_PHONE_NUMBERS, ${nFamily} from FAMILY_ALLOWLIST.`,
    );
  } else {
    console.log(
      'MedFlow seed: no rows added. Set ALLOWED_PHONE_NUMBERS and/or FAMILY_ALLOWLIST in .env (see .env.example).',
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
