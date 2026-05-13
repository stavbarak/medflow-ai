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
exports.RequirementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let RequirementsService = class RequirementsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(appointmentId, dto) {
        await this.ensureAppointment(appointmentId);
        return this.prisma.requirement.create({
            data: {
                appointmentId,
                description: dto.description,
                isDone: dto.isDone ?? false,
            },
        });
    }
    async findAllForAppointment(appointmentId) {
        await this.ensureAppointment(appointmentId);
        return this.prisma.requirement.findMany({
            where: { appointmentId },
            orderBy: { id: 'asc' },
        });
    }
    async update(appointmentId, requirementId, dto) {
        await this.ensureAppointment(appointmentId);
        const req = await this.prisma.requirement.findFirst({
            where: { id: requirementId, appointmentId },
        });
        if (!req) {
            throw new common_1.NotFoundException('פריט לא נמצא');
        }
        return this.prisma.requirement.update({
            where: { id: requirementId },
            data: {
                description: dto.description,
                isDone: dto.isDone,
            },
        });
    }
    async remove(appointmentId, requirementId) {
        await this.ensureAppointment(appointmentId);
        const req = await this.prisma.requirement.findFirst({
            where: { id: requirementId, appointmentId },
        });
        if (!req) {
            throw new common_1.NotFoundException('פריט לא נמצא');
        }
        return this.prisma.requirement.delete({ where: { id: requirementId } });
    }
    async ensureAppointment(id) {
        const n = await this.prisma.appointment.count({ where: { id } });
        if (!n) {
            throw new common_1.NotFoundException('תור לא נמצא');
        }
    }
};
exports.RequirementsService = RequirementsService;
exports.RequirementsService = RequirementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RequirementsService);
//# sourceMappingURL=requirements.service.js.map