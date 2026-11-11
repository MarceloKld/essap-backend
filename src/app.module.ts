import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { schemaEnv } from './config/validation-env';
import { SanteModule } from './modules/sante/sante.module';

@Module({
  imports: [
    // 1) Charge le .env et le valide. isGlobal : disponible partout sans réimporter.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: schemaEnv }),

    // 2) Journaux Pino. On MASQUE les en-têtes sensibles : un jeton ou un cookie
    //    ne doit jamais se retrouver dans un fichier de logs.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined, // en production : JSON brut, plus rapide
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),

    // 3) Limitation GLOBALE : 100 requêtes / minute / IP. On la durcira
    //    route par route (login, matricule...) dans les prochaines étapes.
    ThrottlerModule.forRoot([{ name: 'defaut', ttl: 60_000, limit: 100 }]),

    SanteModule,
  ],
  providers: [
    // « Deny by default » : le limiteur s'applique à TOUTES les routes.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}