import { existsSync } from 'fs';
import { join } from 'path';
import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CLIENT_DIR, CLIENT_INDEX, clientDirReady } from './spa.middleware';

/** Serves SPA at GET / only (excluded from global /api prefix). */
@Controller()
export class RootController {
  /** Browsers request /favicon.ico by default. */
  @Get('favicon.ico')
  favicon(@Res() res: Response): void {
    const ico = join(CLIENT_DIR, 'favicon.ico');
    const png = join(CLIENT_DIR, 'favicon-32x32.png');
    if (existsSync(ico)) {
      res.type('image/x-icon');
      res.sendFile(ico);
      return;
    }
    if (existsSync(png)) {
      res.type('image/png');
      res.sendFile(png);
      return;
    }
    throw new NotFoundException();
  }

  @Get()
  serve(@Res() res: Response): void {
    if (!clientDirReady()) {
      throw new NotFoundException();
    }
    res.sendFile(CLIENT_INDEX);
  }
}
