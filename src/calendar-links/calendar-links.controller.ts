import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppointmentsService } from '../appointments/appointments.service';
import {
  buildGoogleCalendarDayViewUrl,
  buildGoogleCalendarTemplateUrl,
} from '../common/utils/google-calendar-link';
import { isLikelyDateOnlyTime } from '../common/utils/wake-appointment-fields';

@Controller('c')
export class CalendarLinksController {
  constructor(private readonly appointments: AppointmentsService) {}

  /** Short redirect to a prefilled Google Calendar event for an appointment id. */
  @Get('a/:id')
  async appointment(
    @Param('id') id: string,
    @Query('t') t: string | undefined,
    @Res() res: Response,
  ) {
    const row = await this.appointments.findOne(id).catch(() => null);
    if (!row) {
      throw new NotFoundException();
    }

    const hasTime =
      t === '1' ? true : t === '0' ? false : !isLikelyDateOnlyTime(row.dateTime);

    const url = buildGoogleCalendarTemplateUrl({
      title: row.title,
      startDate: new Date(row.dateTime),
      hasTime,
      location: row.location,
      details: [row.notes?.trim(), (row as any).transportNotes?.trim()]
        .filter(Boolean)
        .join('\n'),
    });
    return res.redirect(302, url);
  }

  /** Short redirect to Google Calendar day view (manual removal). */
  @Get('d/:ymd')
  day(@Param('ymd') ymd: string, @Res() res: Response) {
    const m = /^(\d{4})(\d{2})(\d{2})$/u.exec(ymd);
    if (!m) {
      throw new NotFoundException();
    }
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    const url = buildGoogleCalendarDayViewUrl(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
    return res.redirect(302, url);
  }
}

