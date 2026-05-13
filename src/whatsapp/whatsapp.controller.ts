import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappService } from './whatsapp.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.whatsapp.verifyWebhook(mode, token, challenge);
  }

  @Post('webhook')
  async webhook(
    @Req() req: RequestWithRawBody,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = req.rawBody;
    return this.whatsapp.handleWebhookPayload(raw, signature, body);
  }
}
