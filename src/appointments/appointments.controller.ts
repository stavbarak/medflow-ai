import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller('appointments')
@UseGuards(AuthGuard('jwt'))
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointments.create(dto);
  }

  @Get('upcoming')
  upcoming(
    @Query('from') from?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.appointments.upcoming(from, limit);
  }

  @Get('next')
  @HttpCode(200)
  async next(@Res() res: Response) {
    const row = await this.appointments.next();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(row);
  }

  @Get()
  findAll() {
    return this.appointments.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appointments.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointments.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointments.remove(id);
  }
}
