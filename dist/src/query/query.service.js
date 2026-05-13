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
exports.QueryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
let QueryService = class QueryService {
    prisma;
    ai;
    constructor(prisma, ai) {
        this.prisma = prisma;
        this.ai = ai;
    }
    async buildFactsPayload() {
        const now = new Date();
        const upcoming = await this.prisma.appointment.findMany({
            where: { dateTime: { gte: now } },
            orderBy: { dateTime: 'asc' },
            take: 15,
            include: {
                requirements: true,
                responsibleUser: {
                    select: { name: true, phoneNumber: true },
                },
            },
        });
        return {
            generatedAt: now.toISOString(),
            upcomingAppointments: upcoming.map((a) => ({
                id: a.id,
                title: a.title,
                dateTime: a.dateTime.toISOString(),
                location: a.location,
                notes: a.notes,
                responsible: a.responsibleUser,
                requirements: a.requirements.map((r) => ({
                    description: r.description,
                    isDone: r.isDone,
                })),
            })),
        };
    }
    async answerQuestion(question) {
        const facts = await this.buildFactsPayload();
        const factsJson = JSON.stringify(facts, null, 0);
        return this.ai.answerQuestionFromFacts(question, factsJson);
    }
};
exports.QueryService = QueryService;
exports.QueryService = QueryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService])
], QueryService);
//# sourceMappingURL=query.service.js.map