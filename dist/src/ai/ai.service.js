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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = __importDefault(require("openai"));
const ai_validation_1 = require("./ai-validation");
let AiService = class AiService {
    config;
    client;
    model;
    constructor(config) {
        this.config = config;
        const key = this.config.get('OPENAI_API_KEY');
        const baseURL = this.config.get('OPENAI_BASE_URL');
        this.model = this.config.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
        this.client = key
            ? new openai_1.default({
                apiKey: key,
                baseURL: baseURL || undefined,
            })
            : null;
    }
    ensureClient() {
        if (!this.client) {
            throw new common_1.ServiceUnavailableException('שירות בינה מלאכותית לא זמין (חסר מפתח API)');
        }
        return this.client;
    }
    async extractAppointmentFromText(text) {
        const openai = this.ensureClient();
        const completion = await openai.chat.completions.create({
            model: this.model,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `You extract medical appointment information from Hebrew text for ONE patient (father). Return a JSON object only, with optional keys: title (string), dateTime (ISO 8601 string in local Israel context if year missing use current/next plausible date), location (string), notes (string), requirements (array of { description: string }). Use Hebrew text values where appropriate. If a field is unknown, omit it.`,
                },
                { role: 'user', content: text },
            ],
        });
        const raw = completion.choices[0]?.message?.content;
        if (!raw) {
            throw new common_1.ServiceUnavailableException('לא התקבלה תשובה מהמודל');
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            throw new common_1.ServiceUnavailableException('פלט המודל אינו JSON תקין');
        }
        return (0, ai_validation_1.validateAppointmentExtraction)(parsed);
    }
    async answerQuestionFromFacts(question, factsJson) {
        const openai = this.ensureClient();
        const completion = await openai.chat.completions.create({
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: `You answer questions in Hebrew only. Use ONLY the facts JSON provided by the user message labeled FACTS. If the answer is not in the facts, reply briefly that you are not sure or that it is not stored (in Hebrew). Be concise and natural, suitable for WhatsApp.`,
                },
                {
                    role: 'user',
                    content: `FACTS:\n${factsJson}\n\nשאלה:\n${question}`,
                },
            ],
        });
        const text = completion.choices[0]?.message?.content?.trim();
        if (!text) {
            return 'לא הצלחתי להבין. נסו לנסח שוב.';
        }
        return text;
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map