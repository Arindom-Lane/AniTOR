import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { ALLOWED_ORIGINS, HOST, PORT, PUBLIC_DIR } from './config.js';
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    app.useBodyParser('json', { limit: '12mb' });
    app.enableCors({ origin: ALLOWED_ORIGINS });
    app.enableShutdownHooks();
    if (existsSync(PUBLIC_DIR))
        app.useStaticAssets(PUBLIC_DIR);
    await app.listen(PORT, HOST);
    console.log(`AniTOR backend → http://${HOST}:${PORT}`);
    if (process.env.ANITOR_EXIT_WITH_PARENT === '1') {
        process.stdin.resume();
        process.stdin.on('end', () => {
            void app.close().finally(() => process.exit(0));
        });
    }
}
await bootstrap();
//# sourceMappingURL=main.js.map