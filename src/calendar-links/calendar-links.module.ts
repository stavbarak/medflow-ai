import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { CalendarLinksController } from './calendar-links.controller';

@Module({
  imports: [AppointmentsModule],
  controllers: [CalendarLinksController],
})
export class CalendarLinksModule {}

