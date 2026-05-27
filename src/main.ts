import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());
  app.set('trust proxy', 1);

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');
  app.enableCors({ origin: origins, credentials: true });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'), { prefix: '/uploads' });

  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
