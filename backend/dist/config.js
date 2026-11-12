import { join, resolve } from 'node:path';
export const PORT = Number(process.env.PORT ?? 3000);
export const HOST = process.env.HOST ?? '127.0.0.1';
export const DATA_DIR = resolve(process.env.ANITOR_DATA_DIR ?? join(process.cwd(), 'data'));
export const PUBLIC_DIR = resolve(process.env.ANITOR_PUBLIC_DIR ?? join(process.cwd(), '..', 'public'));
export const METADATA_TIMEOUT_MS = Number(process.env.METADATA_TIMEOUT_MS ?? 60_000);
export const IDLE_TIMEOUT_MS = 30_000;
export const ALLOWED_ORIGINS = [
    /^tauri:\/\/localhost$/,
    /^https?:\/\/tauri\.localhost$/,
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
//# sourceMappingURL=config.js.map