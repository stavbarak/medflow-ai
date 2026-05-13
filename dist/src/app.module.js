"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const appointments_module_1 = require("./appointments/appointments.module");
const requirements_module_1 = require("./requirements/requirements.module");
const documents_module_1 = require("./documents/documents.module");
const ai_module_1 = require("./ai/ai.module");
const query_module_1 = require("./query/query.module");
const whatsapp_module_1 = require("./whatsapp/whatsapp.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            appointments_module_1.AppointmentsModule,
            requirements_module_1.RequirementsModule,
            documents_module_1.DocumentsModule,
            ai_module_1.AiModule,
            query_module_1.QueryModule,
            whatsapp_module_1.WhatsappModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map