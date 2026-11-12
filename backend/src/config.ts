import { join, resolve } from 'node:path';

export const PORT = Number(process.env.PORT ?? 3000);

// 127.0.0.1 = only this computer can reach the API (the old Express app
// listened on every network interface, so anyone on your Wi-Fi could use it).
export const HOST = process.env.HOST ?? '127.0.0.1';

// Where history.json lives. Tauri will point this at the app-data folder later.
export const DATA_DIR = resolve(
  process.env.ANITOR_DATA_DIR ?? join(process.cwd(), 'data'),
);

// Phase 1 only: serve the old frontend so you can test in a browser.
export const PUBLIC_DIR = resolve(
  process.env.ANITOR_PUBLIC_DIR ?? join(process.cwd(), '..', 'public'),
);

export const METADATA_TIMEOUT_MS = Number(process.env.METADATA_TIMEOUT_MS ?? 60_000);
export const IDLE_TIMEOUT_MS = 30_000;

// Pages allowed to call this API from a browser. Plain Tauri windows use
// these origins; 1420 is the dev-server port of Tauri's default template.
export const ALLOWED_ORIGINS: RegExp[] = [
  /^tauri:\/\/localhost$/,
  /^https?:\/\/tauri\.localhost$/,
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];