import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { ALLOWED_ORIGINS, HOST, PORT, PUBLIC_DIR } from './config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api'); // every route becomes /api/...
  app.enableCors({ origin: ALLOWED_ORIGINS });
  app.enableShutdownHooks(); // lets services clean up on Ctrl+C

  if (existsSync(PUBLIC_DIR)) app.useStaticAssets(PUBLIC_DIR);

  await app.listen(PORT, HOST);
  console.log(`AniTOR backend → http://${HOST}:${PORT}`);
}
await bootstrap();