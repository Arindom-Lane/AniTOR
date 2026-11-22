import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { ALLOWED_ORIGINS, HOST, PORT, PUBLIC_DIR } from './config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api'); // every route becomes /api/...
  app.useBodyParser('json', { limit: '12mb' });
  app.enableCors({ origin: ALLOWED_ORIGINS });
  app.enableShutdownHooks(); // lets services clean up on Ctrl+C

  if (existsSync(PUBLIC_DIR)) app.useStaticAssets(PUBLIC_DIR);

  await app.listen(PORT, HOST);
  console.log(`AniTOR backend → http://${HOST}:${PORT}`);
  // When the Tauri app starts us it keeps our stdin open. If the app closes or
  // crashes, that pipe closes -> we shut down too instead of lingering forever.
  if (process.env.ANITOR_EXIT_WITH_PARENT === '1') {
    process.stdin.resume();
    process.stdin.on('end', () => {
      void app.close().finally(() => process.exit(0));
    });
  }
}
await bootstrap();
