import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((await import('express')).json({ limit: '50mb' })); // large trips
  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Commute API listening on http://0.0.0.0:${port}`);
}
bootstrap();