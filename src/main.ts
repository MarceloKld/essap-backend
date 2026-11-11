import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function demarrer() {
  // bufferLogs : garde les premiers logs en mémoire jusqu'à ce que Pino soit prêt.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const enProduction = config.get<string>('NODE_ENV') === 'production';

  // --- Sécurité HTTP : en-têtes (anti-clickjacking, sniffing, etc.) ---
  app.use(helmet());

  // --- Cookies : nécessaire pour lire le refresh token HttpOnly (étape B3) ---
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

  // --- Validation GLOBALE de toutes les données entrantes ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // supprime les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // et REFUSE la requête s'il y en a (anti mass-assignment)
      transform: true,            // convertit les types ("5" -> 5)
    }),
  );

  // --- Swagger : documentation, active seulement hors production ---
  if (!enProduction) {
    const options = new DocumentBuilder()
      .setTitle('ESSAP – API Inscriptions & Paiements')
      .setDescription("Documentation de l'API REST ESSAP")
      .setVersion('1.0')
      .addBearerAuth() // bouton « Authorize » pour coller un access token
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, options));
  }

  // Arrêt propre (ferme les connexions base/Redis quand on coupe le serveur)
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
}

void demarrer();