import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function demarrer() {
  // bufferLogs : garde les premiers logs en mÃ©moire jusqu'Ã  ce que Pino soit prÃªt.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const enProduction = config.get<string>('NODE_ENV') === 'production';

  // --- SÃ©curitÃ© HTTP : en-tÃªtes (anti-clickjacking, sniffing, etc.) ---
  app.use(helmet());

  // --- Cookies : nÃ©cessaire pour lire le refresh token HttpOnly (Ã©tape B3) ---
  app.use(cookieParser());

  // --- CORS strict : SEUL notre front a le droit d'appeler l'API depuis un navigateur.
  //     credentials:true autorise l'envoi du cookie du refresh token. ---
  app.enableCors({
    origin: [config.getOrThrow<string>('FRONTEND_URL')],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  // --- URLs : /api/v1/... (versionnement par l'URL) ---
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // --- Validation GLOBALE de toutes les donnÃ©es entrantes ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // supprime les champs non dÃ©clarÃ©s dans le DTO
      forbidNonWhitelisted: true, // et REFUSE la requÃªte s'il y en a (anti mass-assignment)
      transform: true,            // convertit les types ("5" -> 5)
    }),
  );

  // --- Swagger : documentation, active seulement hors production ---
  if (!enProduction) {
    const options = new DocumentBuilder()
      .setTitle('ESSAP â€“ API Inscriptions & Paiements')
      .setDescription("Documentation de l'API REST ESSAP")
      .setVersion('1.0')
      .addBearerAuth() // bouton Â« Authorize Â» pour coller un access token
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, options));
  }

  // ArrÃªt propre (ferme les connexions base/Redis quand on coupe le serveur)
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
}

void demarrer();