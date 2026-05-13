import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  const inDays = (n: number) => {
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
