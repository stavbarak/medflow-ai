import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

const appointmentInclude = {
  responsibleUser: {
    select: { id: true, name: true, phoneNumber: true, role: true },
  },
  requirements: true,
} as const;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        title: dto.title,
        dateTime: new Date(dto.dateTime),
        location: dto.location,
        notes: dto.notes ?? '',
        responsibleUserId: dto.responsibleUserId,
      },
      include: appointmentInclude,
    });
  }

  findAll() {
    return this.prisma.appointment.findMany({
      orderBy: { dateTime: 'asc' },
      include: appointmentInclude,
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
    if (!row) {
      throw new NotFoundException('תור לא נמצא');
    }
    return row;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    await this.ensureExists(id);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        title: dto.title,
        dateTime:
          dto.dateTime !== undefined ? new Date(dto.dateTime) : undefined,
        location: dto.location,
        notes: dto.notes,
        responsibleUserId: dto.responsibleUserId,
      },
      include: appointmentInclude,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.appointment.delete({
      where: { id },
      include: appointmentInclude,
    });
  }

  upcoming(fromIso?: string, limit = 20) {
    const from = fromIso ? new Date(fromIso) : new Date();
    return this.prisma.appointment.findMany({
      where: { dateTime: { gte: from } },
      orderBy: { dateTime: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: appointmentInclude,
    });
  }

  async next() {
    const from = new Date();
    const rows = await this.prisma.appointment.findMany({
      where: { dateTime: { gte: from } },
      orderBy: { dateTime: 'asc' },
      take: 1,
      include: appointmentInclude,
    });
    return rows[0] ?? null;
  }

  private async ensureExists(id: string) {
    const n = await this.prisma.appointment.count({ where: { id } });
    if (!n) {
      throw new NotFoundException('תור לא נמצא');
    }
  }
}
