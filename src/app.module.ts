import { existsSync } from 'fs';
import { join } from 'path';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { RequirementsModule } from './requirements/requirements.module';
import { DocumentsModule } from './documents/documents.module';
import { AiModule } from './ai/ai.module';
import { QueryModule } from './query/query.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

/** Production Docker image copies Vite output here; omit module when absent so local API-only dev still works. */
function clientStaticModule(): DynamicModule[] {
  const rootPath = join(process.cwd(), 'client');
  if (!existsSync(join(rootPath, 'index.html'))) {
    return [];
  }
  return [
    ServeStaticModule.forRoot({
      rootPath,
      exclude: ['/api/{*any}'],
    }),
  ];
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AppointmentsModule,
    RequirementsModule,
    DocumentsModule,
    AiModule,
    QueryModule,
    WhatsappModule,
    ...clientStaticModule(),
  ],
})
export class AppModule {}
