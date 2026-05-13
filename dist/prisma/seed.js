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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    const passwordHash = await bcrypt.hash('demo1234', 10);
    const yael = await prisma.user.upsert({
        where: { phoneNumber: '972501234567' },
        update: {},
        create: {
            name: 'יעל',
            phoneNumber: '972501234567',
            passwordHash,
            role: 'בת',
        },
    });
    const dan = await prisma.user.upsert({
        where: { phoneNumber: '972502987654' },
        update: {},
        create: {
            name: 'דן',
            phoneNumber: '972502987654',
            passwordHash,
            role: 'בן',
        },
    });
    const inDays = (n) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + n);
        d.setUTCHours(10, 0, 0, 0);
        return d;
    };
    const mri = await prisma.appointment.create({
        data: {
            title: 'MRI במחלקת רדיולוגיה',
            dateTime: inDays(3),
            location: 'בית חולים תל השומר — מגדל אונקולוגיה, קומה 2',
            notes: 'להביא טופס 17. צום לפחות 6 שעות לפני הבדיקה',
            responsibleUserId: yael.id,
            requirements: {
                create: [
                    { description: 'להביא טופס 17', isDone: false },
                    { description: 'תוצאות בדיקות דם אחרונות', isDone: false },
                ],
            },
        },
    });
    await prisma.appointment.create({
        data: {
            title: 'קופת חולים — רופא משפחה',
            dateTime: inDays(14),
            location: 'קופת חולים כללית, סניף הרצליה',
            notes: 'לקחת תיק עם תוצאות אחרונות',
            responsibleUserId: dan.id,
        },
    });
    await prisma.medicalDocument.create({
        data: {
            appointmentId: mri.id,
            fileUrl: 'https://example.com/files/summary-he.pdf',
            notes: 'סיכום מבקר אחרון',
            uploadedByUserId: yael.id,
        },
    });
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map