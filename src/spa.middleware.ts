import { existsSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from 'express';

export const CLIENT_DIR = join(process.cwd(), 'client');
export const CLIENT_INDEX = join(CLIENT_DIR, 'index.html');

export function clientDirReady(): boolean {
  return existsSync(CLIENT_INDEX);
}

/** Serves built Vite assets; skips /api (Nest handles API). */
export function clientAssetsMiddleware(): RequestHandler {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express') as typeof import('express');
  return express.static(CLIENT_DIR, { index: false, fallthrough: true });
}

/** SPA index.html for non-API GET routes only. */
export function spaFallbackMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    const path = req.originalUrl.split('?')[0] ?? '';
    if (path.startsWith('/api')) {
      return next();
    }
    res.sendFile(CLIENT_INDEX, (err) => {
      if (err) {
        next(err);
      }
    });
  };
}
