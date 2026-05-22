import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CLIENT_INDEX, clientDirReady } from './spa.middleware';

/** Serves SPA at GET / only (excluded from global /api prefix). */
@Controller()
export class RootController {
  @Get()
  serve(@Res() res: Response): void {
    if (!clientDirReady()) {
      throw new NotFoundException();
    }
    res.sendFile(CLIENT_INDEX);
  }
}
