import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseAllowedPhoneNumbersEnv,
  phoneNumbersFromRoster,
} from '../common/utils/family-roster-env';
import { normalizeIsraeliPhone } from '../common/utils/phone';
import { PHONE_NOT_ON_ALLOWLIST_HE } from './phone-allowlist.messages';

@Injectable()
export class FamilyMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  normalize(input: string): string {
    return normalizeIsraeliPhone(input.trim());
  }

  /** Phones from ALLOWED_PHONE_NUMBERS env (comma-separated, optional :name:gender). */
  getEnvPhones(): string[] {
    const raw = this.config.get<string>('ALLOWED_PHONE_NUMBERS');
    if (!raw?.trim()) {
      return [];
    }
    return phoneNumbersFromRoster(parseAllowedPhoneNumbersEnv(raw));
  }

  async findByPhone(phoneInput: string) {
    const phoneNumber = this.normalize(phoneInput);
    return this.prisma.familyMember.findUnique({
      where: { phoneNumber },
      include: { user: { select: { id: true } } },
    });
  }

  /** Roster entry for a phone from ALLOWED_PHONE_NUMBERS, or null. */
  private envEntry(phoneNumber: string) {
    const raw = this.config.get<string>('ALLOWED_PHONE_NUMBERS');
    if (!raw?.trim()) {
      return null;
    }
    return (
      parseAllowedPhoneNumbersEnv(raw).find(
        (e) => e.phoneNumber === phoneNumber,
      ) ?? null
    );
  }

  /** DB row, or create from ALLOWED_PHONE_NUMBERS env entry when registering. */
  async findOrCreateFromEnv(phoneInput: string) {
    const existing = await this.findByPhone(phoneInput);
    if (existing) {
      await this.healDisplayNameFromEnv(existing.phoneNumber);
      return existing;
    }
    const phoneNumber = this.normalize(phoneInput);
    const entry = this.envEntry(phoneNumber);
    if (!entry) {
      return null;
    }
    return this.prisma.familyMember.upsert({
      where: { phoneNumber },
      create: {
        id: `fm-${phoneNumber}`,
        phoneNumber,
        displayName: entry.displayName,
        gender: entry.gender,
      },
      update: {
        displayName: entry.displayName,
        gender: entry.gender,
      },
      include: { user: { select: { id: true } } },
    });
  }

  /**
   * Self-heal: when a member's `displayName` is still the phone placeholder
   * (e.g. seeded before a name was added, or lost in the family-member
   * migration), backfill the real name + gender from the env roster.
   * Never overwrites a real name a user has already set.
   */
  async healDisplayNameFromEnv(phoneInput: string): Promise<void> {
    const phoneNumber = this.normalize(phoneInput);
    const row = await this.prisma.familyMember.findUnique({
      where: { phoneNumber },
    });
    if (!row || row.displayName !== phoneNumber) {
      return;
    }
    const entry = this.envEntry(phoneNumber);
    if (!entry || !entry.displayName || entry.displayName === phoneNumber) {
      return;
    }
    await this.prisma.familyMember.update({
      where: { phoneNumber },
      data: { displayName: entry.displayName, gender: entry.gender },
    });
  }

  async isAllowed(phoneInput: string): Promise<boolean> {
    const normalized = this.normalize(phoneInput);
    if (this.getEnvPhones().includes(normalized)) {
      return true;
    }
    const row = await this.prisma.familyMember.findUnique({
      where: { phoneNumber: normalized },
    });
    return row != null;
  }

  async assertAllowed(phoneInput: string): Promise<void> {
    if (!(await this.isAllowed(phoneInput))) {
      throw new ForbiddenException(PHONE_NOT_ON_ALLOWLIST_HE);
    }
  }
}
