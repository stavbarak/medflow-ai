import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service';
import { ExtractRequestDto } from './dto/extract-request.dto';

@Controller('ai')
@UseGuards(AuthGuard('jwt'))
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Manual extraction for debugging / tools. */
  @Post('extract')
  extract(@Body() dto: ExtractRequestDto) {
    return this.ai.extractAppointmentFromText(dto.text);
  }
}
