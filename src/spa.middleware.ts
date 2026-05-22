import { existsSync } from 'fs';
import { join } from 'path';
import type { NextFunction, Request, Response } from 'express';

export const CLIENT_DIR = join(process.cwd(), 'client');
export const CLIENT_INDEX = join(CLIENT_DIR, 'index.html');

export function clientDirReady(): boolean {
  return existsSync(CLIENT_INDEX);
}

function requestPath(req: Request): string {
  return (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
}

/** Never run static/SPA logic for API routes. */
export function skipApi(
  handler: (req: Request, res: Response, next: NextFunction) => void,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (requestPath(req).startsWith('/api')) {
      return next();
    }
    return handler(req, res, next);
  };
}

export function createClientHostingMiddleware(): {
  assets: (req: Request, res: Response, next: NextFunction) => void;
  spa: (req: Request, res: Response, next: NextFunction) => void;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express') as typeof import('express');
  const assets = express.static(join(CLIENT_DIR, 'assets'), {
    fallthrough: false,
  });
  const spa = (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    const path = requestPath(req);
    if (path.startsWith('/assets')) {
      return next();
    }
    res.sendFile(CLIENT_INDEX, (err: Error | undefined) => {
      if (err) {
        next(err);
      }
    });
  };
  return { assets, spa };
}
