import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequirementsService } from './requirements.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';

@Controller('appointments/:appointmentId/requirements')
@UseGuards(AuthGuard('jwt'))
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @Post()
  create(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CreateRequirementDto,
  ) {
    return this.requirements.create(appointmentId, dto);
  }

  @Get()
  findAll(@Param('appointmentId') appointmentId: string) {
    return this.requirements.findAllForAppointment(appointmentId);
  }

  @Patch(':requirementId')
  update(
    @Param('appointmentId') appointmentId: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: UpdateRequirementDto,
  ) {
    return this.requirements.update(appointmentId, requirementId, dto);
  }

  @Delete(':requirementId')
  remove(
    @Param('appointmentId') appointmentId: string,
    @Param('requirementId') requirementId: string,
  ) {
    return this.requirements.remove(appointmentId, requirementId);
  }
}
