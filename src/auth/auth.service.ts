import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeIsraeliPhone } from '../common/utils/phone';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';

const BCRYPT_ROUNDS = 10;
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const FORGOT_COOLDOWN_MS = 60 * 1000;

const FORGOT_PASSWORD_ACK =
  'אם המספר רשום במערכת, נשלח אליך ב-WhatsApp קוד לאיפוס סיסמה (בתוקף 15 דקות).';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly forgotCooldown = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async register(dto: RegisterDto) {
    const phoneNumber = this.normalizePhone(dto.phoneNumber);
    const existing = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });
    if (existing) {
      throw new ConflictException('מספר טלפון כבר רשום במערכת');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        phoneNumber,
        passwordHash,
        role: dto.role,
      },
    });
    return this.buildAuthResponse(user.id, user.phoneNumber, user);
  }

  async login(dto: LoginDto) {
    const user = await this.findUserByPhone(dto.phoneNumber);
    if (!user) {
      throw new UnauthorizedException('פרטי התחברות שגויים');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('פרטי התחברות שגויים');
    }
    return this.buildAuthResponse(user.id, user.phoneNumber, user);
  }

  /** Always returns the same message (do not leak whether the phone is registered). */
  async forgotPassword(dto: ForgotPasswordDto) {
    const phoneNumber = this.normalizePhone(dto.phoneNumber);
    const last = this.forgotCooldown.get(phoneNumber);
    if (last && Date.now() - last < FORGOT_COOLDOWN_MS) {
      return { message: FORGOT_PASSWORD_ACK };
    }
    this.forgotCooldown.set(phoneNumber, Date.now());

    const user = await this.findUserByPhone(dto.phoneNumber);
    if (!user) {
      return { message: FORGOT_PASSWORD_ACK };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, codeHash, expiresAt },
    });

    const text = `קוד איפוס MedFlow: ${code}\nבתוקף 15 דקות. אל תשתף את הקוד.`;
    try {
      await this.whatsapp.sendWhatsappMessage(phoneNumber, text);
    } catch (err) {
      this.logger.error(
        `Failed to send password reset WhatsApp to ${phoneNumber}`,
        err instanceof Error ? err.stack : err,
      );
    }

    return { message: FORGOT_PASSWORD_ACK };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const phoneNumber = this.normalizePhone(dto.phoneNumber);
    const user = await this.findUserByPhone(dto.phoneNumber);
    if (!user) {
      throw new BadRequestException('קוד אימות לא תקין או שפג תוקפו');
    }

    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) {
      throw new BadRequestException('קוד אימות לא תקין או שפג תוקפו');
    }

    const codeOk = await bcrypt.compare(dto.code, token.codeHash);
    if (!codeOk) {
      throw new BadRequestException('קוד אימות לא תקין או שפג תוקפו');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return this.buildAuthResponse(user.id, phoneNumber, user);
  }

  private normalizePhone(input: string): string {
    return normalizeIsraeliPhone(input.trim());
  }

  private async findUserByPhone(input: string) {
    const normalized = this.normalizePhone(input);
    return this.prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: normalized }, { phoneNumber: input.trim() }],
      },
    });
  }

  private buildAuthResponse(
    userId: string,
    phoneNumber: string,
    user: {
      id: string;
      name: string;
      phoneNumber: string;
      role: string | null;
    },
  ) {
    const payload: JwtPayload = { sub: userId, phoneNumber };
    const access_token = this.jwt.sign(payload);
    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    };
  }
}
