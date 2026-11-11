import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { ALLOWED_ORIGINS, HOST, PORT, PUBLIC_DIR } from './config.js';
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({ origin: ALLOWED_ORIGINS });
    app.enableShutdownHooks();
    if (existsSync(PUBLIC_DIR))
        app.useStaticAssets(PUBLIC_DIR);
    await app.listen(PORT, HOST);
    console.log(`AniTOR backend → http://${HOST}:${PORT}`);
}
await bootstrap();
//# sourceMappingURL=main.js.map