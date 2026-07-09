import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Application entry point.
 *
 * Two things matter here beyond the usual boilerplate:
 *  - ValidationPipe rejects malformed requests (e.g. a missing
 *    magnetLink) at the door, before they reach a controller.
 *  - CORS is opened up to the React dev server's origin, since
 *    frontend and backend run as two separate processes in dev.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not declared on the DTO
      transform: true, // turn plain query/body objects into DTO class instances
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n AniTOR API running on http://localhost:${port}\n`);
}

bootstrap();
