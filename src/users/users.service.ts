import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FamilyMemberService } from '../phone-allowlist/family-member.service';
import { normalizeIsraeliPhone } from '../common/utils/phone';
import {
  toPublicUser,
  userWithMemberSelect,
} from '../common/utils/user-profile';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyMembers: FamilyMemberService,
  ) {}

  async findByPhone(phoneInput: string) {
    const phoneNumber = normalizeIsraeliPhone(phoneInput.trim());
    const member = await this.prisma.familyMember.findUnique({
      where: { phoneNumber },
      include: { user: { select: userWithMemberSelect } },
    });
    return member?.user ? toPublicUser(member.user) : null;
  }

  async findOne(id: string) {
    let user = await this.prisma.user.findUnique({
      where: { id },
      select: userWithMemberSelect,
    });
    if (!user) {
      return null;
    }
    // Self-heal a placeholder name (phone) from the allowlist roster, so the
    // logged-in user's real name shows up without re-seeding or re-registering.
    if (user.familyMember.displayName === user.familyMember.phoneNumber) {
      await this.familyMembers.healDisplayNameFromEnv(
        user.familyMember.phoneNumber,
      );
      user = await this.prisma.user.findUnique({
        where: { id },
        select: userWithMemberSelect,
      });
    }
    return user ? toPublicUser(user) : null;
  }

  async update(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, familyMemberId: true },
    });

    if (dto.phoneNumber) {
      const phoneNumber = normalizeIsraeliPhone(dto.phoneNumber);
      const taken = await this.prisma.familyMember.findFirst({
        where: {
          phoneNumber,
          NOT: { id: user.familyMemberId },
        },
      });
      if (taken) {
        throw new ConflictException('מספר טלפון כבר בשימוש');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.update({
        where: { id: user.familyMemberId },
        data: {
          ...(dto.name !== undefined ? { displayName: dto.name } : {}),
          ...(dto.phoneNumber !== undefined
            ? { phoneNumber: normalizeIsraeliPhone(dto.phoneNumber) }
            : {}),
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        },
      });
      return tx.user.update({
        where: { id: userId },
        data: { ...(dto.role !== undefined ? { role: dto.role } : {}) },
        select: userWithMemberSelect,
      });
    });

    return toPublicUser(updated);
  }
}
