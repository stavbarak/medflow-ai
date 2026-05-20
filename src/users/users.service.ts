import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(userId: string, dto: UpdateUserDto) {
    if (dto.phoneNumber) {
      const taken = await this.prisma.user.findFirst({
        where: {
          phoneNumber: dto.phoneNumber,
          NOT: { id: userId },
        },
      });
      if (taken) {
        throw new ConflictException('מספר טלפון כבר בשימוש');
      }
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        role: dto.role,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
