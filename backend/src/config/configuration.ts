/**
 * Central place for every environment-driven setting.
 * Imported once by ConfigModule.forRoot({ load: [configuration] })
 * in app.module.ts, then injected anywhere via ConfigService.
 *
 * Keeping this as a single typed function (rather than reading
 * process.env scattered across services) means there's exactly
 * one place to look when tuning behaviour, and one place to add
 * a new setting.
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Storage
  useMemoryStore: process.env.USE_MEMORY_STORE !== 'false', // default: true
  cacheDir: process.env.CACHE_DIR || 'temp_cache',
  historyFile: process.env.HISTORY_FILE || 'history.json',

  // Idle cleanup
  idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT_MS ?? '240000', 10), // 4 min
  idleCheckIntervalMs: parseInt(process.env.IDLE_CHECK_INTERVAL_MS ?? '5000', 10),

  // Streaming
  pieceWindowBytes: parseInt(process.env.PIECE_WINDOW_BYTES ?? String(4 * 1024 * 1024), 10),

  // VLC
  vlcPath: process.env.VLC_PATH || '',
});
