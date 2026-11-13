import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { schemaEnv } from './config/validation-env.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';
import { EtudiantsModule } from './modules/etudiants/etudiants.module.js';
import { InstitutsModule } from './modules/instituts/instituts.module.js';
import { SanteModule } from './modules/sante/sante.module.js';
import { ScolariteModule } from './modules/scolarite/scolarite.module.js';
import { UtilisateursModule } from './modules/utilisateurs/utilisateurs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: schemaEnv }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      },
    }),

    ThrottlerModule.forRoot([{ name: 'defaut', ttl: 60_000, limit: 100 }]),

    PrismaModule,
    AuditModule,
    AuthModule,
    InstitutsModule,
    UtilisateursModule,
    ScolariteModule,
    EtudiantsModule,
    SanteModule,
  ],
  providers: [
    // L'ORDRE COMPTE : 1) débit  2) qui es-tu ?  3) as-tu le droit ?
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}