import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeIsraeliPhone } from '../common/utils/phone';
import { PHONE_NOT_ON_ALLOWLIST_HE } from './phone-allowlist.messages';

@Injectable()
export class PhoneAllowlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  normalize(input: string): string {
    return normalizeIsraeliPhone(input.trim());
  }

  /** Numbers from ALLOWED_PHONE_NUMBERS (comma-separated, 972… or 05…). */
  getEnvAllowlist(): string[] {
    const raw = this.config.get<string>('ALLOWED_PHONE_NUMBERS');
    if (!raw?.trim()) {
      return [];
    }
    return [
      ...new Set(
        raw
          .split(',')
          .map((part) => this.normalize(part))
          .filter((p) => p.length > 0),
      ),
    ];
  }

  async isAllowed(phoneInput: string): Promise<boolean> {
    const normalized = this.normalize(phoneInput);
    if (this.getEnvAllowlist().includes(normalized)) {
      return true;
    }
    const row = await this.prisma.allowedPhone.findUnique({
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
