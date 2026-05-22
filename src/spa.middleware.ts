import { existsSync } from 'fs';
import { join } from 'path';

export const CLIENT_DIR = join(process.cwd(), 'client');
export const CLIENT_INDEX = join(CLIENT_DIR, 'index.html');

export function clientDirReady(): boolean {
  return existsSync(CLIENT_INDEX);
}
