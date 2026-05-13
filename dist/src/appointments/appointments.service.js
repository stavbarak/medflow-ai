"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const appointmentInclude = {
    responsibleUser: {
        select: { id: true, name: true, phoneNumber: true, role: true },
    },
    requirements: true,
};
let AppointmentsService = class AppointmentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(dto) {
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
    async findOne(id) {
        const row = await this.prisma.appointment.findUnique({
            where: { id },
            include: appointmentInclude,
        });
        if (!row) {
            throw new common_1.NotFoundException('תור לא נמצא');
        }
        return row;
    }
    async update(id, dto) {
        await this.ensureExists(id);
        return this.prisma.appointment.update({
            where: { id },
            data: {
                title: dto.title,
                dateTime: dto.dateTime !== undefined ? new Date(dto.dateTime) : undefined,
                location: dto.location,
                notes: dto.notes,
                responsibleUserId: dto.responsibleUserId,
            },
            include: appointmentInclude,
        });
    }
    async remove(id) {
        await this.ensureExists(id);
        return this.prisma.appointment.delete({
            where: { id },
            include: appointmentInclude,
        });
    }
    upcoming(fromIso, limit = 20) {
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
    async ensureExists(id) {
        const n = await this.prisma.appointment.count({ where: { id } });
        if (!n) {
            throw new common_1.NotFoundException('תור לא נמצא');
        }
    }
};
exports.AppointmentsService = AppointmentsService;
exports.AppointmentsService = AppointmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppointmentsService);
//# sourceMappingURL=appointments.service.js.map