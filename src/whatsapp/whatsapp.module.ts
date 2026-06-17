import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { AiModule } from '../ai/ai.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { QueryModule } from '../query/query.module';
import { ConversationModule } from '../conversation/conversation.module';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [
    AiModule,
    AppointmentsModule,
    QueryModule,
    ConversationModule,
    ContactsModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
