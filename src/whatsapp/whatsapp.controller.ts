import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsappService } from './whatsapp.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  // @Get('webhook')
  // verify(
  //   @Query('hub.mode') mode: string,
  //   @Query('hub.verify_token') token: string,
  //   @Query('hub.challenge') challenge: string,
  // ) {
  //   return this.whatsapp.verifyWebhook(mode, token, challenge);
  // }

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Forbidden');
  }

  @Post()
  async webhook(
    @Req() req: RequestWithRawBody,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = req.rawBody;
    return this.whatsapp.handleWebhookPayload(raw, signature, body);
  }
}
