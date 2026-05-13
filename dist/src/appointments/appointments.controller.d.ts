import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
export declare class AppointmentsController {
    private readonly appointments;
    constructor(appointments: AppointmentsService);
    create(dto: CreateAppointmentDto): import(".prisma/client").Prisma.Prisma__AppointmentClient<{
        responsibleUser: {
            id: string;
            phoneNumber: string;
            name: string;
            role: string | null;
        } | null;
        requirements: {
            id: string;
            description: string;
            isDone: boolean;
            appointmentId: string;
        }[];
    } & {
        id: string;
        title: string;
        dateTime: Date;
        location: string;
        notes: string;
        responsibleUserId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    upcoming(from?: string, limit?: number): import(".prisma/client").Prisma.PrismaPromise<({
        responsibleUser: {
            id: string;
            phoneNumber: string;
            name: string;
            role: string | null;
        } | null;
        requirements: {
            id: string;
            description: string;
            isDone: boolean;
            appointmentId: string;
        }[];
    } & {
        id: string;
        title: string;
        dateTime: Date;
        location: string;
        notes: string;
        responsibleUserId: string | null;
    })[]>;
    next(): Promise<{
        responsibleUser: {
            id: string;
            phoneNumber: string;
            name: string;
            role: string | null;
        } | null;
        requirements: {
            id: string;
            description: string;
            isDone: boolean;
            appointmentId: string;
        }[];
    } & {
        id: string;
        title: string;
        dateTime: Date;
        location: string;
        notes: string;
        responsibleUserId: string | null;
    }>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        responsibleUser: {
            id: string;
            phoneNumber: string;
            name: string;
            role: string | null;
        } | null;
        requirements: {
            id: string;
            description: string;
            isDone: boolean;
            appointmentId: string;
        }[];
    } & {
        id: string;
        title: string;
        dateTime: Date;
        location: string;
        notes: string;
        responsibleUserId: string | null;
    })[]>;
    findOne(id: string): Promise<{
        responsibleUser: {
            id: string;
            phoneNumber: string;
            name: string;
            role: string | null;
        } | null;
        requirements: {
            id: string;
            description: string;
            isDone: boolean;
            appointmentId: string;
        }[];
    } & {
        id: string;
        title: string;
        dateTime: Date;
        location: string;
        notes: string;
        responsibleUserId: string | null;
    }>;
    update(id: string, dto: UpdateAppointmentDto): Promise<{
        responsibleUser: {
            id: string;
            phoneNumber: string;
            name: string;
            role: string | null;
        } | null;
        requirements: {
            id: string;
            description: string;
            isDone: boolean;
            appointmentId: string;
        }[];
    } & {
        id: string;
        title: string;
        dateTime: Date;
        location: string;
        notes: string;
        responsibleUserId: string | null;
    }>;
    remove(id: string): Promise<{
        responsibleUser: {
            id: string;
            phoneNumber: string;
            name: string;
            role: string | null;
        } | null;
        requirements: {
            id: string;
            description: string;
            isDone: boolean;
            appointmentId: string;
        }[];
    } & {
        id: string;
        title: string;
        dateTime: Date;
        location: string;
        notes: string;
        responsibleUserId: string | null;
    }>;
}
