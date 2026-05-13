"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WhatsappService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const appointments_service_1 = require("../appointments/appointments.service");
const requirements_service_1 = require("../requirements/requirements.service");
const query_service_1 = require("../query/query.service");
const phone_1 = require("../common/utils/phone");
const question_heuristic_1 = require("../common/utils/question-heuristic");
let WhatsappService = WhatsappService_1 = class WhatsappService {
    config;
    prisma;
    ai;
    appointments;
    requirements;
    query;
    logger = new common_1.Logger(WhatsappService_1.name);
    constructor(config, prisma, ai, appointments, requirements, query) {
        this.config = config;
        this.prisma = prisma;
        this.ai = ai;
        this.appointments = appointments;
        this.requirements = requirements;
        this.query = query;
    }
    verifyWebhook(mode, token, challenge) {
        const verifyToken = this.config.get('WHATSAPP_VERIFY_TOKEN');
        if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
            return challenge ?? '';
        }
        throw new common_1.UnauthorizedException('אימות וובהוק נכשל');
    }
    verifySignature(rawBody, signature) {
        const secret = this.config.get('WHATSAPP_APP_SECRET');
        if (!secret) {
            this.logger.warn('WHATSAPP_APP_SECRET לא מוגדר — דילוג על אימות חתימה');
            return;
        }
        if (!rawBody || !signature?.startsWith('sha256=')) {
            throw new common_1.UnauthorizedException('חתימה חסרה');
        }
        const expected = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');
        const received = signature.slice(7);
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(received, 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            throw new common_1.UnauthorizedException('חתימה לא תקינה');
        }
    }
    async handleWebhookPayload(rawBody, signature, body) {
        this.verifySignature(rawBody, signature);
        const messages = this.extractInboundMessages(body);
        for (const m of messages) {
            await this.dispatchMessage(m).catch((err) => {
                this.logger.error(err instanceof Error ? err.message : err);
            });
        }
        return { status: 'ok' };
    }
    extractInboundMessages(body) {
        const out = [];
        const root = body;
        const entries = root.entry ?? [];
        for (const e of entries) {
            for (const c of e.changes ?? []) {
                for (const msg of c.value?.messages ?? []) {
                    if (msg.type === 'text' && msg.from && msg.text?.body) {
                        out.push({ from: msg.from, text: msg.text.body });
                    }
                }
            }
        }
        return out;
    }
    async dispatchMessage(message) {
        const normalized = (0, phone_1.normalizeIsraeliPhone)(message.from);
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [{ phoneNumber: normalized }, { phoneNumber: message.from }],
            },
        });
        if (!user) {
            await this.sendWhatsAppReply(message.from, 'מספר זה לא רשום במערכת. יש להירשם דרך האפליקציה.');
            return;
        }
        const text = message.text.trim();
        if (!text) {
            return;
        }
        if ((0, question_heuristic_1.looksLikeQuestion)(text)) {
            try {
                const answer = await this.query.answerQuestion(text);
                await this.sendWhatsAppReply(message.from, answer);
            }
            catch {
                await this.sendWhatsAppReply(message.from, 'לא הצלחתי לענות כרגע. נסו שוב מאוחר יותר.');
            }
            return;
        }
        try {
            const extracted = await this.ai.extractAppointmentFromText(text);
            if (!extracted.dateTime || !extracted.location) {
                await this.sendWhatsAppReply(message.from, 'לא הצלחתי לזהות תאריך או מיקום. נסו לנסח שוב.');
                return;
            }
            const title = extracted.title?.trim() || 'תור';
            const created = await this.appointments.create({
                title,
                dateTime: extracted.dateTime,
                location: extracted.location,
                notes: extracted.notes ?? '',
                responsibleUserId: user.id,
            });
            if (extracted.requirements?.length) {
                for (const r of extracted.requirements) {
                    await this.requirements.create(created.id, {
                        description: r.description,
                    });
                }
            }
            const when = new Date(created.dateTime).toLocaleString('he-IL', {
                dateStyle: 'short',
                timeStyle: 'short',
            });
            await this.sendWhatsAppReply(message.from, `הוספתי תור ל-${when} ב${created.location}.`);
        }
        catch {
            await this.sendWhatsAppReply(message.from, 'לא הצלחתי לעבד את ההודעה. נסו שוב או פתחו תור דרך האפליקציה.');
        }
    }
    async sendWhatsAppReply(toRaw, body) {
        const token = this.config.get('WHATSAPP_ACCESS_TOKEN');
        const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
        if (!token || !phoneNumberId) {
            this.logger.log(`[WhatsApp לא מוגדר] ל-${toRaw}: ${body}`);
            return;
        }
        const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: toRaw.replace(/\D/g, ''),
                type: 'text',
                text: { preview_url: false, body },
            }),
        });
        if (!res.ok) {
            const errText = await res.text();
            this.logger.error(`WhatsApp send failed: ${res.status} ${errText}`);
            throw new common_1.BadRequestException('שליחת הודעת וואטסאפ נכשלה');
        }
    }
};
exports.WhatsappService = WhatsappService;
exports.WhatsappService = WhatsappService = WhatsappService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        ai_service_1.AiService,
        appointments_service_1.AppointmentsService,
        requirements_service_1.RequirementsService,
        query_service_1.QueryService])
], WhatsappService);
//# sourceMappingURL=whatsapp.service.js.map