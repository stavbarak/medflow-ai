import { Injectable, NotFoundException } from '@nestjs/common';
import { jerusalemCalendarDayRange } from '../common/utils/appointment-datetime';
import {
  transportUserDisplay,
  transportUserSelect,
} from '../common/utils/user-profile';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

const appointmentInclude = {
  responsibleUser: { select: transportUserSelect },
  transportUser: { select: transportUserSelect },
  requirements: true,
} as const;

type TransportUserDisplay = ReturnType<typeof transportUserDisplay>;
type AppointmentRow = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;
export type AppointmentDto = Omit<
  AppointmentRow,
  'responsibleUser' | 'transportUser'
> & {
  responsibleUser: TransportUserDisplay;
  transportUser: TransportUserDisplay;
};

function mapAppointment(row: AppointmentRow): AppointmentDto {
  return {
    ...(row as Omit<AppointmentRow, 'responsibleUser' | 'transportUser'>),
    responsibleUser: transportUserDisplay(row.responsibleUser),
    transportUser: transportUserDisplay(row.transportUser),
  };
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppointmentDto): Promise<AppointmentDto> {
    const row = await this.prisma.appointment.create({
      data: {
        title: dto.title,
        dateTime: new Date(dto.dateTime),
        timeKnown: dto.timeKnown ?? true,
        location: dto.location,
        notes: dto.notes ?? '',
        transportNotes: dto.transportNotes ?? '',
        transportUserId: dto.transportUserId,
        responsibleUserId: dto.responsibleUserId,
      },
      include: appointmentInclude,
    });
    return mapAppointment(row);
  }

  async findAll(): Promise<AppointmentDto[]> {
    const rows = await this.prisma.appointment.findMany({
      orderBy: { dateTime: 'asc' },
      include: appointmentInclude,
    });
    return rows.map(mapAppointment);
  }

  async findOne(id: string): Promise<AppointmentDto> {
    const row = await this.prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
    if (!row) {
      throw new NotFoundException('תור לא נמצא');
    }
    return mapAppointment(row);
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<AppointmentDto> {
    await this.ensureExists(id);
    const row = await this.prisma.appointment.update({
      where: { id },
      data: {
        title: dto.title,
        dateTime:
          dto.dateTime !== undefined ? new Date(dto.dateTime) : undefined,
        timeKnown: dto.timeKnown,
        location: dto.location,
        notes: dto.notes,
        transportNotes: dto.transportNotes,
        transportUserId: dto.transportUserId,
        responsibleUserId: dto.responsibleUserId,
      },
      include: appointmentInclude,
    });
    return mapAppointment(row);
  }

  async remove(id: string): Promise<AppointmentDto> {
    await this.ensureExists(id);
    const row = await this.prisma.appointment.delete({
      where: { id },
      include: appointmentInclude,
    });
    return mapAppointment(row);
  }

  async upcoming(fromIso?: string, limit = 20): Promise<AppointmentDto[]> {
    const from = fromIso ? new Date(fromIso) : new Date();
    const rows = await this.prisma.appointment.findMany({
      where: { dateTime: { gte: from } },
      orderBy: { dateTime: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: appointmentInclude,
    });
    return rows.map(mapAppointment);
  }

  async next(): Promise<AppointmentDto | null> {
    const from = new Date();
    const rows = await this.prisma.appointment.findMany({
      where: { dateTime: { gte: from } },
      orderBy: { dateTime: 'asc' },
      take: 1,
      include: appointmentInclude,
    });
    return rows[0] ? mapAppointment(rows[0]) : null;
  }

  async findOnCalendarDay(day: Date): Promise<AppointmentDto[]> {
    const { start, end } = jerusalemCalendarDayRange(day);
    const rows = await this.prisma.appointment.findMany({
      where: { dateTime: { gte: start, lt: end } },
      orderBy: { dateTime: 'asc' },
      include: appointmentInclude,
    });
    return rows.map(mapAppointment);
  }

  async findMostRecentlyCreated(): Promise<AppointmentDto | null> {
    const row = await this.prisma.appointment.findFirst({
      orderBy: { createdAt: 'desc' },
      include: appointmentInclude,
    });
    return row ? mapAppointment(row) : null;
  }

  private async ensureExists(id: string) {
    const n = await this.prisma.appointment.count({ where: { id } });
    if (!n) {
      throw new NotFoundException('תור לא נמצא');
    }
  }
}
