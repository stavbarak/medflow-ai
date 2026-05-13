import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';

@Injectable()
export class RequirementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(appointmentId: string, dto: CreateRequirementDto) {
    await this.ensureAppointment(appointmentId);
    return this.prisma.requirement.create({
      data: {
        appointmentId,
        description: dto.description,
        isDone: dto.isDone ?? false,
      },
    });
  }

  async findAllForAppointment(appointmentId: string) {
    await this.ensureAppointment(appointmentId);
    return this.prisma.requirement.findMany({
      where: { appointmentId },
      orderBy: { id: 'asc' },
    });
  }

  async update(
    appointmentId: string,
    requirementId: string,
    dto: UpdateRequirementDto,
  ) {
    await this.ensureAppointment(appointmentId);
    const req = await this.prisma.requirement.findFirst({
      where: { id: requirementId, appointmentId },
    });
    if (!req) {
      throw new NotFoundException('פריט לא נמצא');
    }
    return this.prisma.requirement.update({
      where: { id: requirementId },
      data: {
        description: dto.description,
        isDone: dto.isDone,
      },
    });
  }

  async remove(appointmentId: string, requirementId: string) {
    await this.ensureAppointment(appointmentId);
    const req = await this.prisma.requirement.findFirst({
      where: { id: requirementId, appointmentId },
    });
    if (!req) {
      throw new NotFoundException('פריט לא נמצא');
    }
    return this.prisma.requirement.delete({ where: { id: requirementId } });
  }

  private async ensureAppointment(id: string) {
    const n = await this.prisma.appointment.count({ where: { id } });
    if (!n) {
      throw new NotFoundException('תור לא נמצא');
    }
  }
}
