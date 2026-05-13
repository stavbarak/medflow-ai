import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { AiModule } from '../ai/ai.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { RequirementsModule } from '../requirements/requirements.module';
import { QueryModule } from '../query/query.module';

@Module({
  imports: [AiModule, AppointmentsModule, RequirementsModule, QueryModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
